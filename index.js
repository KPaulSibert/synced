export function SymbolScope(name){
    return new Proxy({},{
        get(cache,key,r){
            return cache[key]||(cache[key] = Symbol(`${name}:${key}`))
        }
    })
}
function *iterSymbols(obj){
    let current = obj
    while(current){
        for(const symbol of Object.getOwnPropertySymbols(current)){
            const [scope,name] = symbol.description.split(':')
            yield [scope,name,current[symbol],current]
        }
        current = current.__proto__
    }
}
export const web = SymbolScope('web')
export const cmp = SymbolScope('computed')// todo
export const fld = SymbolScope('field')// todo
export function WebType(type,server,name){
    const ctx = {objects:{},server,name,
        provideId(id){
            return id in this.objects?this.objects[id]:(this.objects[id] = Object.assign(new this(id),{id}))
        }
    }
    const proxyHandler = {
        get(t,p){return p in ctx?ctx[p]:t[p]} 
    }
    const proxy = new Proxy(type,proxyHandler)
    const opts = {proxy,proxyHandler,ctx}
    for(const [scope,name,val,tg] of iterSymbols(type)){
        if(!(scope in symbolHandlers)){continue}
        symbolHandlers[scope](tg,name,{val,isProto:false,...opts})
    }
    for(const [scope,name,val,tg] of iterSymbols(type.prototype)){
        if(!(scope in symbolHandlers)){continue}
        symbolHandlers[scope](tg,name,{val,isProto:true,...opts})
    }
    if(type.bindServer){type.bindServer(ctx,ctx)}
    return proxy
}
export default class Server{
    constructor(url=""){
        this.url = url
    }
    add(types={}){
        for(const [tname,type] of Object.entries(types)){
            types[tname] = WebType(type,this,tname)
        }
        Object.assign(this.types,types)
        return types
    }
    table(data){
        const parseTable = (data)=>{
            let {fields,values,type,...other} = data;
            type = this.getType(type);
            Object.assign(type,other)
            if(!values){return}
            for(const [id,arr] of Object.entries(values)){
                const obj = {}
                for(const [i,val] of Object.entries(arr)){
                    const field = fields[i]
                    const ftype = type.prototype[fld[field]]
                    if(ftype){
                        const parser = ftype.parseField || ftype.provideId
                        obj[field] = parser.apply(ftype,[val,type,field])
                    }else{
                        obj[field] = val
                    }
                }
                Object.assign(type.provideId(id),obj)
            }
        }
        if(Array.isArray(data)){return data.map(e=>parseTable(e))}
        else{return parseTable(data)}
    }
    getType(data){
        if(Array.isArray(data)){
            const [name,...args] = data
            const type = this.types[name]
            if(!type)return;
            const fn = type.generic || ((o)=>({...o,__proto__:type}));
            return fn(...args)
        }else{return this.types[data]}
    }
    types = {}
    url = ""
}
export class Model{ 
    static [web.all](r){this.server.table(r)} 
    static vals(){return Object.values(this.objects)}
}
// symbolHandlers
export const symbolHandlers = {
    web(tg,name,{val:cb,isProto}){
        tg[name] = async function(args){
            let type = isProto?this.class:this
            if(isProto){args = [this.id,args]}
            const req = await fetch(`${type.server.url}/${type.name}/${name}`,{method:'POST',body:JSON.stringify(args)})
            let result = await req.json()   
            if(cb){
                const modifed = cb.apply(this,[result])
                if(modifed!=undefined){result = modifed}
            }
            return result
        }
    },
    cmp(tg,name,{val:cb,isProto}){

    }
}
// types
export class jsonType{
    static parseField(val){ return JSON.parse(val)}
}
export class dateType{
    static parseField(val){ return val && new Date(val)}
}