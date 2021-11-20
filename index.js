export function SymbolScope(name){
    let proxy
    const cache = {}
    return proxy = new Proxy(()=>{},{
        get(fn,key,r){
            return cache[key]||(cache[key] = Symbol(`${name}:${key}`))
        },
        apply(tg,_,[obj,self]){
            if(obj=='in'){
                return [...iterSymbols(self)].filter(([s])=>s==name).map(a=>a.splice(1))
            }else if(obj=='from'){
                return Object.fromEntries([...iterSymbols(self)].filter(([s])=>s==name).map(a=>[a[1],a[2]]))
            }else{
                const ret = {}
                for(const key in obj){ret[proxy[key]] = obj[key]}
                return ret
            }
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
export const fld = SymbolScope('field')
export const ctr = SymbolScope('constructor')
export const cfg = SymbolScope('config')
export const on = SymbolScope('event')
export function newClass(obj,ext=Object,ctrs={}){
    const {constructor:ctr,name,...props} = obj
    const classGener = new Function('ctrs','ext',`return class ${name} extends ext{
        constructor(...args){super();for(const ctr of Object.values(ctrs)){ctr.apply(this,args)}}}`)
    const cls = classGener(ctrs,ext)
    Object.assign(cls,props)
    return cls
}
export function setupType(type,opts={}){
    for(const [scope,name,val,tg] of iterSymbols(type)){
        if(!(scope in setupType.handlers)){continue}
        setupType.handlers[scope](tg,name,{val,isProto:false,...opts})
    }
    for(const [scope,name,val,tg] of iterSymbols(type.prototype)){
        if(!(scope in setupType.handlers)){continue}
        setupType.handlers[scope](tg,name,{val,isProto:true,...opts})
    }
}
setupType.handlers = {
    web(tg,name,{val:cb,isProto}){
        tg[name] = async function(args){
            const type = isProto?this.constructor:this
            const server = type[cfg.server]
            if(isProto){args = [this.id,args]}
            const req = await fetch(`${server.url}/${type.name}/${name}`,{method:'POST',body:JSON.stringify(args)})
            let result = await req.json()
            result = server.fromJSON(result)
            if(cb){
                const modifed = cb.apply(this,[result])
                if(modifed!=undefined){result = modifed}
            }
            return result
        }
    },
    constructor(tg,name,{val,ctrs}){ctrs[name] = val}
}
export default class Server{
    constructor(url=""){
        this.url = url
    }
    bindType(type){
        const ctrs = {} //constructors
        const newType = newClass({name:type.name,[cfg.server]:this},type,ctrs)
        setupType(newType,{ctrs,newType})
        if(type[on.extend]){type[on.extend](newType,newType)}
        return newType
    }
    add(types={}){
        for(const [tname,type] of Object.entries(types)){
            types[tname] = this.bindType(type)
        }
        Object.assign(this.types,types)
        return types
    }
    fromJSON(data){
        if(data!=null && typeof data =="object"){
            for(const key of Object.keys(data)){
                data[key] = this.fromJSON(data[key])
            }
            if(data.$t){
                const type = this.types[data.$t]
                if(!type||!type[cfg.fromJSON]){
                    throw Error(`${data.$t} type or his 'fromJSON' handler wasnt found`)}
                delete data.$t
                return type[cfg.fromJSON](data)
            }
        }
        return data
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
    static [web.all](){}
    [web.update](){} 
    static vals(){return Object.values(this.objects)}
    static parseField(val){return this.provideId(val)}
    static dumpField(val){return val.id}
    static provideId(id){
        return id in this.objects?this.objects[id]:(this.objects[id] = Object.assign(new this(id),{id}))
    }
    static [cfg.fromJSON](data){
            let {fields,values,...other} = data;
            Object.assign(this,other)
            if(!values){return}
            for(const [id,arr] of Object.entries(values)){
                if(arr==null){console.log(id)
                    delete this.objects[id];continue}
                const obj = {}
                for(const [i,val] of Object.entries(arr)){
                    const field = fields[i]
                    const ftype = this.prototype[fld[field]]
                    if(ftype?.parseField){
                        const parser = ftype.parseField
                        obj[field] = parser.apply(ftype,[val,this,field])
                    }else{
                        obj[field] = val
                    }
                }
                Object.assign(this.provideId(id),obj)
            }
    }
    static [on.extend](cls){cls.objects = {}}
}
export function dumpInst(obj){
    const ret = {}
    for(const [key,val] of Object.entries(obj)){
        const ftype = obj[fld[key]]
        if(ftype?.dumpField){
            ret[key] = ftype.dumpField(val)
        }
        else if(val==null || !['object','function'].includes(typeof val)){
            ret[key] = val
        }
    }
    return ret
    
}
// types
export class jsonType{
    static parseField(val){ return JSON.parse(val)}
    static dumpField(val){ return JSON.stringify(val)}
}
export class dateType{
    static parseField(val){ return val && new Date(val)}
    static dumpField(val){return val&&val.toISOString().substr(0,10)}
}