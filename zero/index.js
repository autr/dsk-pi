import fs from 'fs'
import path from 'path'
import { spawn, execSync }  from 'child_process'
import keypress from 'keypress'
import template from './template.svg.js'

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

let DEBUG = false
let ERRORS = false
let IDX = 0
let PROC = null
let SHOW = null
let VOL = 0.5
let LIST = [] 
let GAP = 1000
let TIMEOUT = null

let args = {
    player: e => process.platform == 'darwin' ? 'mplayer' : 'omxplayer',
    volume: e => process.platform == 'darwin' ? `--volume ${VOL}` : `--vol ${VOL}`,
    aspect: e => `--aspect-mode stretch`
}

const DIR = path.dirname(import.meta.url.replaceAll('file://', ''))
const STATIC = path.resolve( DIR, '../static' )
const BASE = path.resolve( STATIC, './samples/Terraforms.DSK.I' )
const BIN = path.resolve( DIR, './bin' )
const player = e => process.platform == 'darwin' ? 'mplayer' : 'omxplayer'

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
            await execSync( `pkill ${args.player()}`) 
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


const show = async e => {

    if (SHOW) {
        await KILL.fbi()
        SHOW = null
    }
    await execSync( `sudo fbi -d /dev/fb0 -T 1 --nocomments --noverbose --cachemem 1 ${path.resolve(BIN, `${IDX}.png`)}`)
}

const start = async e => {

    if (TIMEOUT) {
        clearTimeout( TIMEOUT )
        TIMEOUT = null
    }

    await show()

    await KILL.player()
    PROC = null

    TIMEOUT = setTimeout( ee => {

        const entry = LIST[IDX]
        const url = path.resolve(BASE, entry.file )

        console.log(`[zero] playing ${entry.title} -> ${ path.basename(url) }`)
        PROC = spawn( args.player(), [ url] )
        PROC.stdin.setEncoding = 'utf-8'
        PROC.stdout.on('data', data => {
            if (DEBUG) console.log(`[${args.player()}]`, data.toString())
        })
        
        PROC.stderr.on('data', data => {
            if (ERRORS) console.error(`[${args.player()}]`, data.toString())
        })
        PROC.on('exit', async (code, id) => {
            console.log(`[${args.player()}] exited with code ${code}`, id )
            PROC = null
            if (code == 0) {
                console.log(`[${args.player()}] skipping next from code ${code}`)
                await skip(1)
            }
        })

    }, GAP)

}

const create = async e => {
    for (let i = 0; i < LIST.length; i++ ) {
        const o = LIST[i]
        const svg = path.resolve(BIN, `${i}.svg` )
        const png = path.resolve(BIN, `${i}.png` )
        const cmd = `rsvg-convert ${svg} > ${png}` 
        await fs.writeFileSync( svg, template(o) ) 
        console.log(svg, png, cmd)
        await execSync( cmd )
    }
}

const run = async e => {

    await KILL.fbi()
    await KILL.player()

    try {
        VOL = parseFloat( await (await fs.readFileSync( path.resolve( STATIC, 'volume.txt') )).toString() )
        console.log(`[zero] volume.txt ${VOL}`)
    } catch(err) {
        return console.error(`[zero] could not load volume.txt ${err.message}`)
    } 
    try {
        GAP = parseInt( await (await fs.readFileSync( path.resolve( STATIC, 'timeout.txt') )).toString() )
        console.log(`[zero] timeout.txt ${VOL}`)
    } catch(err) {
        return console.error(`[zero] could not load timeout.txt ${err.message}`)
    } 
    try {
        LIST = JSON.parse( await (await fs.readFileSync( path.resolve( BASE, 'playlist.json') )).toString() )
    } catch(err) {
        return `[zero] could not load playlist.json ${err.message}` 
    }

    await create()

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