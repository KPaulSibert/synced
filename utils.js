import {ref,computed,reactive} from "vue"
import {colors} from "quasar"
export const client = reactive({width:innerWidth,height:innerHeight})
addEventListener('resize',()=>{client.width = innerWidth;client.height = innerHeight})
export class Color{
    static GRADIENTS = [
        [[180,255,130],[255,255,130],[255,210,130]],
        [[242,190,235],[130,130,180],[130,130,255],[180,255,255]]
    ]
    constructor(r,g,b,a = 99){
        Object.assign(this,{r,g,b,a})
    }
    static mix(set,pc){
        let ret = []
        let splits = set.length-1
        let pos = pc<1?Math.floor(pc*splits):splits-1
        let c1 = set[pos]
        let c2 = set[pos+1]
        for (let i = 0; i < 3; i++) {
            ret[i] = Math.round(c1[i]+(c2[i]-c1[i])*((pc-pos/splits)*splits))
        }
        return new Color(...ret)
    }
    toRGB(){
        return `rgb(${this.r},${this.g},${this.b})`
    }
    toRGBA(a=null){
        return `rgba(${this.r},${this.g},${this.b},${a?a:this.a})`
    }
    toHex(){
        return colors.rgbToHex(this)
    }
}
export function download(fname,text){
    const el = document.createElement('a')
    el.setAttribute('href','data:text/plain;charset=utf8,'+encodeURIComponent(text));
    el.setAttribute('download',fname)
    el.style.display = 'none'
    document.body.appendChild(el)
    el.click()
    document.body.removeChild(el);
}
// extension 
Number.prototype.clamp = function(min,max){
    return Math.min(Math.max(this,min),max)
}
Date.prototype.normalize = function (min,max = Date.now()){
    return 1-((max-this)/(max-min)).clamp(0,1)
}
Date.prototype.interval = function(){
    let type = "дней"
    let ret = Math.round((Date.now()-this)/1000/60/60/24)
    if(ret > 365){
        type = "лет"
        ret = Math.round(ret/365*10)/10
    }
    else if(ret > 40){
        type = "месяцев"
        ret = Math.round(ret/30*10)/10
    }
    return `${ret} ${type}`
}
Date.fromIntStr = function(str) {
    let m = str.match(/(\d\d)(\d\d)(\d\d)/)
    return str.length==6? new Date("20"+m[1],m[2]-1,m[3]):new Date(str)
}