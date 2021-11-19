import {reactive,computed} from "vue"
import {setupType,Model,cmp} from "./index.js"
Model.bindServer = function(ctx){ctx.objects = reactive({})}
setupType.handlers.computed = function(tg,name,{val:cb,isProto,ctrs}){
    if(!ctrs.computed){
        ctrs.computed = function(){
            for(const [name,val,tg] of cmp('in',this)){
                this[name] = computed(val.bind(this))
            }    
        }
    }
}