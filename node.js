import http from 'http'
import URL from "url"
import Synced,{cfg,Server} from './inedx.js'
export async function getBody(req){
    return new Promise((ok)=>{
      let data = ''
      req.on('data',(c)=>data+=c)
      req.on('end',()=>ok(data))
    })
}
export function notFound(res,msg){
    console.log('return "not fond"')
    res.statusCode = 404;
    res.end(msg)
}
Synced.add(Server,{run(){
    const {host,port} = this
    const server = this.server = http.createServer(async (req, res) => {
        const url = URL.parse(req.url,true)
        let path = decodeURI(url.pathname);res.statusCode=200;
        res.setHeader('Content-Type','application/json')
        let msg = url.query['$msg']
        let args
        if(!msg||req.method!='POST'){
            msg = req.method
        }else{
            args = JSON.parse(await getBody(req))
        }
        const ret = await this.receive(path,msg,args,req,res)
        if(!res.writableEnded){res.end(JSON.stringify(ret))}
    })
    server.listen(port,host,()=>{console.log(`Server running at http://${host}:${port}/`);})
}})
export default Server