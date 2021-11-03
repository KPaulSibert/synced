export function SymbolScope(name){
    return new Proxy({},{
        get(cache,key,r){
            return cache[key]||(cache[key] = Symbol(`${name}:${key}`))
        }
    })
}
export const cfg = SymbolScope('cfg')// object configuration
export const pcfg = SymbolScope('pcfg')// property/function configuration
export const init = SymbolScope('init') // init functions(constructor)
export const msg = SymbolScope('msg')// message handlers
export const fromResp = {
   async str(r){return await r.text()},
   async json(r){return await r.json()}
}
export const toReq = {
    str({path,body}){return fetch(path,{method:"POST",body})},
    json({path,value}){return fetch(path,{method:"POST",body:JSON.stringify(value)})},
    pyargs({path,args,kwargs}){return toReq.json({path,value:[args,kwargs]})}
}
export const parser = {
    table(){},
    obj_info(dct,opts){
        const inp = toReq[dct.inp||'pyargs']
        const out = fromResp[dct.out||'json']
        const parser = parser[dct.post]
        function fn(...args){
           return send({...opts,inp,out,parser,args})
        }
    }
}
const defOpts = {port:2020,prefix:'/api',inp:toReq.pyargs,out:fromResp.json,path:''}
export async function send(opts={}){
    const {path,port,prefix,host,inp,out,parser,...other} = {...defOpts,...opts}
    // build urlpath
    if(host){prefix = `http://${host}:${port}${prefix}`}
    opts = {path:prefix+(path||''),...other}
    // handle request
    let ret = await out(await inp(opts),opts)
    if(parser){ret = await parser(ret,opts)}
    return ret
    
}
export default function remote(obj){
    return new Proxy(obj,{
        get(tg,key){
            if(key instanceof Symbol&&type[key]){return type[key]}
            const handler = type[key]||type[cfg.pdef]
            if(handler?.get){return handler.get(tg,key)}
            else{return stg[key]}
        }
    })
}