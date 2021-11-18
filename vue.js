import {reactive,computed} from "vue"
import {symbolHandlers,Model,cmp} from "./index.js"
Model.bindServer = function(ctx){ctx.objects = reactive({})}
symbolHandlers.computed = function(tg,name,{val:cb,isProto,ctrs}){
    if(!ctrs.computed){
        ctrs.computed = function(){
            for(const [name,val,tg] of cmp('in',this)){
                this[name] = computed(val.bind(this))
            }    
        }
    }
}