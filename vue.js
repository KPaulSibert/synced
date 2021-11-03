import {ref,watch} from "vue"
import { cfg,init } from "./index"
export const vprop = {
    mount(pr,name){
      pr[init[`vprop:${name}`]]= function(){
        const prop = this[name] = ref(this[name])
        requestAnimationFrame(async()=>{
          prop.value = await this[cfg.send]('getprop',name)
          watch(prop,(v)=>{
            this[cfg.send]('setprop',[name,v])
          })
        })
      }
    }
  }