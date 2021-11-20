import {reactive,computed} from "vue"
import {setupType,Model,SymbolScope, on} from "./index.js"
export const cmp = SymbolScope('computed')
export const fn = SymbolScope('method')
export const wtc = SymbolScope('watch')
export const ref = SymbolScope('vuedata')
export const cnt = SymbolScope('component')
export const inp = SymbolScope('props')
Model[on.extend] = function(ctx){ctx.objects = reactive({})}
setupType.handlers.computed = function(tg,name,{val:cb,isProto,ctrs}){
    if(!ctrs.computed){
        ctrs.computed = function(){
            for(const [name,val,tg] of cmp('in',this)){
                this[name] = computed(val.bind(this))
            }    
        }
    }
}
export function component(obj){
    const computed = cmp('from',obj)
    const methods = fn('from',obj)
    const watch = wtc('from',obj)
    let data = ref('from',obj)
    const props = inp('from',obj)
    const components = cnt('from',obj)
    const ret = {computed,methods,watch,props,components}
    for(const key of Object.getOwnPropertyNames(obj)){
        ret[key] = obj[key]
    }
    if(Object.keys(data).length){ret.data = ()=>({...data})}
    return ret
}