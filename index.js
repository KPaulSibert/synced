/* 
add vue 
configureWebpack:{
    resolve:{
      alias:{
        'synced':path.resolve(__dirname,'../', 'synced')
      }
    }
    
  },
*/

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
export const rmt = SymbolScope('remote')
export const fld = SymbolScope('field')
export const ctr = SymbolScope('constructor')
export const cfg = SymbolScope('config')
export const on = SymbolScope('event')
// dynamically define Class (with Base class)
export function newClass(name,base){
    const classGener = new Function('ext',`return class ${name} extends ext{}`)
    return classGener(base)
}
// iterates all Symbols in class (and class prototype) and calls its handlers
export function setupClass(type,handlers={},opts={}){
    for(const [scope,name,val,tg] of iterSymbols(type)){
        if(!(scope in handlers)){continue}
        handlers[scope](tg,name,{val,isProto:false,...opts})
    }
    for(const [scope,name,val,tg] of iterSymbols(type.prototype)){
        if(!(scope in handlers)){continue}
        handlers[scope](tg,name,{val,isProto:true,...opts})
    }
    return opts
}
// Symbol listeners for Namespace binding 
export const bindHandlers = {
    remote(tg,key,{val:cb,isProto}){
        tg[key] = async function(args){
            const type = isProto?this.constructor:this
            const src = this[cfg.ns][cfg.src]
            if(isProto){args = [this.id,args]}
            const req = await fetch(`${src}/${type.name}/${key}`,{method:'POST',body:JSON.stringify(args)})
            let result = await req.json()
            result = server.fromJSON(result)
            if(cb){
                const modifed = cb.apply(this,[result])
                if(modifed!=undefined){result = modifed}
            }
            return result
        }
    }
}
export class Namespace{
    constructor(name,types={},src){
        this[cfg.name] = name
        this[cfg.add](types)
        this[cfg.src]=src || '/'+name
    }
    [cfg.add](types){
        for(const [tname,type] of Object.entries(types)){
            // bound type (with Namespace)
            let boundType = newClass(`${this[cfg.name]}_${tname}`,type);
            // add namespace reference
            boundType[cfg.ns] = this
            boundType.prototype[cfg.ns] = this
            const ctx = {type:boundType}
            ({type:boundType} = setupClass(boundType,bindHandlers,ctx));
            types[tname] = boundType
        }
        Object.assign(this,types)
        return types
    }
}
export class Model{
    static vals(){return Object.values(this.objects)}
    static provideId(id){
        return id in this.objects?this.objects[id]:(this.objects[id] = Object.assign(new this(id),{id}))
    }
    // remote Functions
    static [rmt.all](){}
    [rmt.update](){} 
    // Events
    static [on.bindNS](cls){cls.objects = {}}
    // Serialization
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
    static [cfg.parseField](val){return this.provideId(val)}
    static [cfg.dumpField](val){return val.id}
}
// search objects with "$t" property and parse them
export function processJSON(data,namespace){
    if(data!=null && typeof data =="object"){
        for(const key of Object.keys(data)){
            data[key] = this.fromJSON(data[key])
        }
        if(data[ "$t" ]){
            const type = namespace[data.$t]
            if(!type||!type[cfg.fromJSON]){
                throw Error(`${data.$t} type or his 'fromJSON' handler wasnt found`)}
            delete data.$t
            return type[cfg.fromJSON](data)
        }
    }
    return data
}
export function toJSON(obj){
    const ret = {}
    for(const [key,val] of Object.entries(obj)){
        const fieldDescriber = obj[fld[key]]
        if(fieldDescriber?.[cfg.dumpField]){
            ret[key] = fieldDescriber[cfg.dumpField](val,obj,key)
        }
        // if val is not Object
        else if(val==null || !['object','function'].includes(typeof val)){
            ret[key] = val
        }
    }
    return ret
}
// types
export const jsonField = {
    [cfg.parseField](val){ return JSON.parse(val)},
    [cfg.dumpField](val){ return JSON.stringify(val)}
}
export const dateField = {
    [cfg.parseField](val){ return val && new Date(val)},
    [cfg.dumpField](val){return val&&val.toISOString().substr(0,10)}
}