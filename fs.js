import Synced from "./index.js"
export const __dir = dirname(fileURLToPath(import.meta.url));
import {existsSync, mkdir,lstatSync,readdirSync, readFileSync, writeFileSync} from "fs"
import { dirname,join } from "path";
export const PATH = dirname(__dir);
export class FSManager extends Synced{
    root = PATH
    readDir(path=""){
        return readdirSync(join(this.root,path))
    }
    mkdir(path){return mkdir(join(this.root,path))}
    writeFile(path="",data){
        return writeFileSync(join(this.root,path),data)
    }
    readFile(path=""){
        return readFileSync(join(this.root,path))
    }
    exists(path){
        return existsSync(join(this.root,path))
    }

}