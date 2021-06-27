const fs = require('fs')
const path = require('path')
const { spawn, execSync }  = require('child_process')
const keypress = require('keypress')
const template = require('./template.svg.js')
const MODES = require('./modes.js')
const minimist = require('minimist')
const os = require('os')

console.log('[zero] current user', os.userInfo().username, process.env.USER)

const RPiGPIOButtons = require('rpi-gpio-buttons')

let ARGS = minimist( process.argv.slice(2) ) 
const VOLUP = 'VOLUP'
const VOLDOWN = 'VOLDOWN'
const OMNI = 'OMNI'
const SKIPNEXT = 'SKIPNEXT'
const SKIPPREV = 'SKIPPREV'
const PLAYPAUSE = 'PLAYPAUSE'

const BTNS = {
    12: VOLUP,
    9: VOLDOWN,
    8: OMNI,
    11: SKIPNEXT,
    10: PLAYPAUSE,
    7: SKIPPREV
}

console.log( `[zero] pins ${Object.keys(BTNS).join(',')}`)

let buttons = new RPiGPIOButtons( { 
    pins: Object.keys(BTNS),
    mode: RPiGPIOButtons.MODE_BCM,
    usePullUp: false,
    debounce: 10,
    pressed: 10,
    clicked: 10
} )

buttons.on('pressed', async pin => {
    let PIN = BTNS[pin] 
    console.log('[zero] released', PIN)
    
})
buttons.on('clicked', async pin => {
    let PIN = BTNS[pin] 
    console.log('[zero] clicked', PIN)
    
})
buttons.on('released', async pin => {
    let PIN = BTNS[pin]
    console.log('[zero] pressed', PIN)

    if ( PIN == OMNI ) {
        MODE_TOGGLE = !MODE_TOGGLE
        await modish( 0 )
    }

    if ( PIN == SKIPPREV ) {
        if (!MODE_TOGGLE) await skip(-1)
        if (MODE_TOGGLE) await modish(-1)
    }
    if ( PIN == SKIPNEXT ) {
        if (!MODE_TOGGLE) await skip(1)
        if (MODE_TOGGLE) await modish(1)
    }

    if ( PIN == VOLDOWN && PROC ) {
        if (!MODE_TOGGLE) await PROC.stdin.write('-')
        if (MODE_TOGGLE) await modish(-1)
    }
    if ( PIN == VOLUP && PROC ) {
        if (!MODE_TOGGLE) await PROC.stdin.write('+')
        if (MODE_TOGGLE) await modish(1)
    }

    if ( PIN == PLAYPAUSE ) {
        if (!MODE_TOGGLE) await toggle()
        if (MODE_TOGGLE) {
            const C = await config()

            if (!C.found) {
                C += `
${STR.BEGIN}
${STR.MODE}
${MODES[MODE].code}
${STR.END}
                `
                console.log(C)
            }

        }
    }

})

// const exits = [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]

// exits.forEach((eventType) => {
//     process.on(eventType, e => {
//         console.log('YOYOYOYO EXIT', eventType) 
//         return process.exit(0)
//     }) 
// })

buttons.init().catch(err => console.error('[zero] error initialising buttons:', err.message) )

let KEYBOARD = false

if (KEYBOARD) {

    keypress(process.stdin)

    process.stdin.on('keypress', async (ch, key) => {

        console.log('[zero] keypress', key.name)

        if ( key.name == 'escape' ) {
            await KILL.player()
            await KILL.fbi()
            await KILL.node()
        }

        if ( key.name == 'left' ) await skip(-1)
        if ( key.name == 'right' ) await skip(1)

        if ( key.name == 'down' && PROC ) await PROC.stdin.write('-')
        if ( key.name == 'up' && PROC ) await PROC.stdin.write('+')

        if ( key.name == 'space' ) toggle()
        if ( key && key.ctrl && key.name == 'c' ) process.stdin.pause()
    });
     
    process.stdin.setRawMode(true);
    process.stdin.resume();


}

let DEBUG = false
let FORCE = ARGS.f
let ERRORS = false
let IDX = 0
let PROC = null
let SHOW = null
let VOL = 0.5
let LIST = [] 
let GAP = 1000
let TIMEOUT = null
let MODE = 0


let CMDS = {
    player: e => process.platform == 'darwin' ? 'mplayer' : 'omxplayer',
    volume: e => process.platform == 'darwin' ? `--volume ${VOL}` : `--vol ${VOL}`,
    aspect: e => `--aspect-mode stretch`
}
if ( !ARGS._[0] ) return console.error('[zero] exiting - no folder specified')
let ROOT = path.resolve( ARGS._[0] )
let BIN = path.resolve( ROOT, './bin' )
const DIRS = {
    ROOT,
    BIN,
    VOL: path.resolve( BIN, './volume.txt'),
    PLAYLIST: path.resolve( ROOT, './playlist.json'),
    TIMEOUT: path.resolve( BIN, './timeout.txt')
}

const KILL = {
    fbi: async e => {
        try { 
            await execSync( `sudo pkill fbi`) 
        } catch(err) {}
    },
    node: async e => {
        try {  
            await execSync( `sudo pkill node`)
        } catch(err) {}
    },
    player: async e => {
        try { 
            await execSync( `pkill ${CMDS.player()}`) 
        } catch(err) {}
    }
}

const skip = async num => {
    IDX += num
    if (IDX < 0) IDX = LIST.length - 1
    if (IDX >= LIST.length) IDX = 0
    console.log(`[zero] switched IDX ${IDX}` )
    await start()

}
const toggle = async e => {
    console.log('[zero] pause / play')
    if (PROC) PROC.stdin.write(' ')
}


const show = async (type, idx) => {

    if (SHOW) {
        await KILL.fbi()
        SHOW = null
    }
    await execSync( `sudo fbi -d /dev/fb0 -T 1 --nocomments --noverbose --cachemem 1 ${path.resolve(DIRS.BIN, `${type}-${idx}.png`)}`)
}

let MODE_TOGGLE = false

const modish = async num => {
    MODE += num
    if (MODE < 0) MODE = MODES.length - 1
    if (MODE >= MODES.length) MODE = 0
    if (MODE_TOGGLE) {
        await show('mode', MODE)
        await KILL.player()
    } else {
        await start()
    }
}

const start = async e => {

    if (TIMEOUT) {
        clearTimeout( TIMEOUT )
        TIMEOUT = null
    }

    await show('video', IDX)

    await KILL.player()
    PROC = null

    TIMEOUT = setTimeout( ee => {

        const entry = LIST[IDX]
        const url = path.resolve(DIRS.ROOT, entry.file )

        console.log(`[zero] playing ${entry.title} -> ${ path.basename(url) }`)
        PROC = spawn( CMDS.player(), [ url] )
        PROC.stdin.setEncoding = 'utf-8'
        PROC.stdout.on('data', data => {
            if (DEBUG) console.log(`[${CMDS.player()}]`, data.toString())
        })
        
        PROC.stderr.on('data', data => {
            console.error(`[${CMDS.player()}]`, data.toString())
        })
        PROC.on('exit', async (code, id) => {
            console.log(`[${CMDS.player()}] exited with code ${code}`, id )
            PROC = null
            if (code == 0) {
                console.log(`[${CMDS.player()}] skipping next from code ${code}`)
                await skip(1)
            }
        }) 

    }, GAP)

}

const create = async (type, list) => {
    let count = 0
    for (let i = 0; i < list.length; i++ ) {
        const o = list[i]
        const svg = path.resolve(DIRS.BIN, `${type}-${i}.svg` )
        const png = path.resolve(DIRS.BIN, `${type}-${i}.png` )

        if (!(await fs.existsSync( png )) || FORCE ) {
            const cmd = `MAGICK_FONT_PATH=/usr/share/fonts/truetype/custom rsvg-convert ${svg} > ${png}` 
            await fs.writeFileSync( svg, template(o) ) 
            await execSync( cmd )
            count += 1
        }

    }

    if (count > 0) console.log(`[zero] generated ${count} ${type} overlays`)
}

let STR = {
    BEGIN: '# <DSK>',
    END: '# <DSK>',
    MODE: '# MODE='
}

const config = async e => {

    const str = await (await fs.readFileSync( `/boot/config.txt` )).toString()

    const a = str.indexOf(STR.BEGIN)
    const b = str.indexOf(STR.END)
    const found = b < a || a == -1 || b == -1

    return { a, b, found, str }
}

const run = async e => {

    await KILL.fbi()
    await KILL.player()

    // let PINS = Object.keys(BTNS)
    // for (let i = 0; i < PINS.length; i++){
    //     let PIN = PINS[i]
    //     console.log(`[zero] refreshing pin ${PIN}`)
    //     try { await execSync(`echo ${PIN} > /sys/class/gpio/unexport`) } catch(err) {}
    // }

    if ( !(await fs.existsSync( DIRS.BIN )) ) {
        console.log('[zero] creating bin...')
        await fs.mkdirSync( DIRS.BIN )
    }

    // READ VOL

    try {
        if ( !(await fs.existsSync( DIRS.VOL )) ) await fs.writeFileSync( DIRS.VOL, VOL + '' )
        VOL = parseFloat( await (await fs.readFileSync( DIRS.VOL )).toString() )
        console.log(`[zero] volume.txt ${VOL}`)
    } catch(err) {
        return console.error(`[zero] could not load volume.txt ${err.message}`)
    }

    // READ TIMEOUT / GAP

    try {
        if ( !(await fs.existsSync( DIRS.TIMEOUT )) ) await fs.writeFileSync( DIRS.TIMEOUT, GAP + '' )
        GAP = parseInt( await (await fs.readFileSync( DIRS.TIMEOUT )).toString() )
        console.log(`[zero] timeout.txt ${VOL}`)
    } catch(err) {
        return console.error(`[zero] could not load timeout.txt ${err.message}`) 
    }

    // READ PLAYLIST 

    try {
        LIST = JSON.parse( await (await fs.readFileSync( DIRS.PLAYLIST )).toString() )
    } catch(err) {
        return console.error(`[zero] could not load playlist.json ${err.message}`)
    }

    // READ MODE

    try {
        const { str, a, b, found } = await config()

        if ( found ) {
            MODE = 0
            console.log('[zero] no explicit mode set from config (auto)')
        } else {
            const c = str.indexOf(STR.MODE)
            const num = str.split(c)[1].split('\n')[0]
            console.log('NUMBER IS???', num)
            MODE = parseInt( num ) || 0
        }

    } catch(err) {
        return console.error(`[zero] could not load playlist.json ${err.message}`)
    }

    await create('video', LIST)
    await create('mode', MODES)

    start()
}

run()


/* OMXPLAYER KEY BINDINGS 

1 Increase Speed
2 Decrease Speed
j Previous Audio stream
k Next Audio stream
i Previous Chapter
o Next Chapter
n Previous Subtitle stream
m Next Subtitle stream
s Toggle subtitles
q Exit OMXPlayer
Space or p Pause/Resume
- Decrease Volume
+ Increase Volume
Left Seek -30
Right Seek +30
Down Seek -600
Up Seek +600
*/