export function SymbolScope(name){
    return new Proxy({},{
        get(cache,key,r){
            return cache[key]||(cache[key] = Symbol(`${name}:${key}`))
        }
    })
}
/**@param {Server} srv */
export function table(srv,data){
    function parseTable(data){
        let {fields,values,type,...other} = data;
        type = srv.getType(type);
        Object.assign(type,other)
        for(const [id,arr] of Object.entries(values)){
            srv.updateObj(type,id,Object.fromEntries(fields.map((e,i)=>[e,arr[i]])))
        }
    }
    if(Array.isArray(data)){return data.map(e=>parseTable(data))}
    else{return parseTable(data)}
}
export const web = SymbolScope('web')

export default class Server{
    constructor(url=""){
        this.url = url
    }
    add(types={}){
        Object.assign(this.types,types);
        for(const [tname,type] of Object.entries(types)){
            if(type.objects==undefined){type.objects = {}}
            for(const symbol of Object.getOwnPropertySymbols(type)){
                const [scope,name] = symbol.description.split(':')
                if(scope=='web'){
                    const cb = type[symbol]
                    type[name] = webmethod(this,tname,name,cb)
                }
            }
        }
    }
    updateObj(type,id,data){
        if(id in type.objects){Object.assign(type.objects[id],data)}
        else{data.id = id;type.objects[id] = data}
        return
    }
    getType(name){return this.types[name]}
    types = {}
    url=""
}
export function webmethod(server,type,name,cb){
    const fn = async function(args){
        const req = await fetch(`${server.url}/${type}/${name}`,{method:'POST',body:JSON.stringify(args)})
        let result = await req.json()
        if(cb){
            const modifed = cb(result)
            if(modifed!=undefined){result = modifed}
        }
        return result
    }
    Object.defineProperty(fn, 'name', {value: name, writable: false});
    return fn
}