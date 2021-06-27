
const MODE = (title, name, role, code) => ( { title, credits: [ { name, role } ], code } )

const AUTO = 'AUTO'
const SDTV = 'SDTV'
const HDMI = 'HDMI'

module.exports = [
    MODE( 
        AUTO, 
        `Auto-detect`,`CVBS or HDMI`, 
        `` ),
    MODE( 
        SDTV, 
        `NTSE`, 
        `interlaced`, 
        `sdtv=0` ),
    MODE( 
        SDTV, 
        `NTSE`, 
        `Japanese`, 
        `sdtv=1` ),
    MODE( 
        SDTV, 
        `PAL`, 
        `interlaced`, 
        `sdtv=2` ),
    MODE( 
        SDTV, 
        `PAL`, 
        `Brazilian`, 
        `sdtv=3` ),
    MODE( 
        SDTV, 
        `NTSE`, 
        `progressive scan`, 
        `sdtv=16` ),
    MODE( 
        SDTV, 
        `PAL`, 
        `progressive scan`, 
        `sdtv=18` ),
    MODE( 
        HDMI, 
        `Force`, 
        `3.5mm audio`, 
        `hdmi_group=0\nhdmi_force_hotplug=1\nhdmi_drive=1` ),
    MODE( 
        HDMI, 
        `Force`, 
        `HDMI audio`, 
        `hdmi_group=0\nhdmi_force_hotplug=1\nhdmi_drive=2` )
]