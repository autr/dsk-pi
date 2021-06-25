import fs from 'fs'
import path from 'path'
import { spawn }  from 'child_process'
import keypress from 'keypress'

keypress(process.stdin)

process.stdin.on('keypress', (ch, key) => {

    console.log('[zero] keypress', key.name)

    if ( key.name == 'left' ) skip(-1)
    if ( key.name == 'right' ) skip(1)

    if ( key.name == 'down' ) volume(-0.1)
    if ( key.name == 'up' ) volume(0.1)

    if ( key.name == 'space' ) toggle()
    if ( key && key.ctrl && key.name == 'c' ) process.stdin.pause()
});
 
process.stdin.setRawMode(true);
process.stdin.resume();

let DEBUG = false
let IDX = 0
let PROC = null
let VOL = 0.5
let LIST = [] 


let args = {
    player: e => process.platform == 'darwin' ? 'mplayer' : 'omxplayer',
    volume: e => process.platform == 'darwin' ? `--volume ${VOL}` : `--vol ${VOL}`,
}

const DIR = path.dirname(import.meta.url.replaceAll('file://', ''))
const STATIC = path.resolve( DIR, '../static' )
const BASE = path.resolve( STATIC, './samples/Terraforms.DSK.I' )
const BIN = path.resolve( DIR, './bin' )
const player = e => process.platform == 'darwin' ? 'mplayer' : 'omxplayer'

const skip = num => {
    IDX += num
    if (IDX < 0) IDX = LIST.length - 1
    if (IDX >= LIST.length) IDX = 0
    console.log(`[zero] switched IDX ${IDX}` )
    PROC ? PROC.exit(35) : play()

}
const volume = num => {
    VOL += num
    console.log(`[zero] switched VOL ${VOL}` )
    PROC.stdin.write(' ')

}

const toggle = async e => {
    console.log('[zero] pause / play')
    if ( !PROC ) return play()
    PROC.stdin.write(' ')
}

const play = async e => {

    const entry = LIST[IDX]
    const url = path.resolve(BASE, entry.file )

    console.log(`[zero] playing ${entry.title} -> ${ path.basename(url) }`)
    PROC = spawn( args.player(), [ url] )
    PROC.stdin.setEncoding = 'utf-8'
    PROC.stdout.on('data', data => {
        if (DEBUG) console.log(`[${args.player()}]`, data.toString())
    })
    
    PROC.stderr.on('data', data => {
        if (DEBUG) console.error(`[${args.player()}]`, data.toString())
    })
    PROC.on('exit', (code, id) => {
        console.log(`[${args.player()}] exited with code ${code}`, id )
        PROC = null
        if (code == 1) {
            console.log(`[${args.player()}] code 1: restarting with IDX ${IDX}`)
            play()
        }
    })


    // console.log('PROC IS', PROC)
}

const run = async e => {

    try {
        VOL = parseFloat( await (await fs.readFileSync( path.resolve( STATIC, 'volume.txt') )).toString() )
        console.log(`[zero] volume.txt ${VOL}`)
    } catch(err) {
        return console.error(`[zero] could not load volume.txt ${err.message}`)
    }
    try {
        LIST = JSON.parse( await (await fs.readFileSync( path.resolve( BASE, 'playlist.json') )).toString() )
    } catch(err) {
        return `[zero] could not load playlist.json ${err.message}`
    }

    play()
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