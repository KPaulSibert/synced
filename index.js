export function SymbolScope(name){
    return new Proxy({},{
        get(cache,key,r){
            return cache[key]||(cache[key] = Symbol(`${name}:${key}`))
        }
    })
}
export const web = SymbolScope('web')
export function WebType(type,server,name){
    const ctx = {objects:{},server,name,
        provideId(id){
            return id in this.objects?this.objects[id]:(this.objects[id] = Object.assign(new this(id),{id}))
        }
    }
    const proxy = new Proxy(type,{
        get(t,p){return p in ctx?ctx[p]:t[p]},
         
    })
    type.prototype.class = proxy
    let proto = type
    while(proto){
        for(const symbol of Object.getOwnPropertySymbols(proto)){
            const [scope,name] = symbol.description.split(':')
            if(scope=='web' && !ctx[name]){
                const cb = proto[symbol]
                ctx[name] = webmethod(proxy,name,cb)
            }
        }
        proto = proto.__proto__
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
                    const ftype = type.fields?.[field]
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
    url=""
}
export class Model{ 
    static [web.all](r){this.server.table(r)} 
    static vals(){return Object.values(this.objects)}
}
export function webmethod(type,name,cb){
    const fn = async function(args){
        const req = await fetch(`${type.server.url}/${type.name}/${name}`,{method:'POST',body:JSON.stringify(args)})
        let result = await req.json()
        if(cb){
            const modifed = cb.apply(this,[result])
            if(modifed!=undefined){result = modifed}
        }
        return result
    }
    return fn
}
export class jsonType{
    static parseField(val){ return JSON.parse(val)}
}
export class dateType{
    static parseField(val){ return val && new Date(val)}
}