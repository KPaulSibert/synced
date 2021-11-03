import json,inspect
from types import MethodType,FunctionType
from django.apps.config import AppConfig
from django.db.models.base import Model
from django.db.models.query import QuerySet
from django.http.request import HttpRequest
from django.apps import apps
from django.http.response import HttpResponse, HttpResponseNotFound,JsonResponse
from django.views.decorators import http,csrf
def getitem(obj,key):
    return obj[key] if hasattr(obj, "__getitem__") else getattr(obj,key)
def subs(obj,key = None,req = None):
    fn = getattr(obj,'_web_sub')
    dct = {}
    # extract dict
    if callable(fn):
        argCount = len(inspect.getargspec(fn).args)-1
        args = [key,req]
        # return value from function
        if key and argCount>0:
            return fn(*args[:argCount])
        else: dct = fn(*args[:argCount])
    elif isinstance(fn,list):
        dct = {name:getitem(obj,name) for name in list}
    elif isinstance(fn,dict):
        dct = fn
    # add web functions
    proto = obj.__class__.__dict__
    for prop in proto:
        if prop == '_web_fn':continue
        val = proto[prop]
        if callable(val) and hasattr(val,'_web_inp'):
            dct[prop] = val
    return dct if key is None else dct.get(key)
# formats
class Inp:
    def string(r,fn):
        return ([r.body if r.method =='POST' else None],None)
    def json(r,fn):
        return json.loads(r.body) if r.method =='POST' else r.GET.dict()
    def pyargs(r,fn):
        args = []
        kwargs = kwargs = r.GET.dict()
        spec = inspect.getargspec(fn)
        if r.method=='POST':
            [args,kw] = json.loads(r.body)
            kwargs.update(kw)
        if('_r' in spec.args):kwargs['_r'] = r
        return (args,kwargs)
class Out:
    def string(s):
        ret =  HttpResponse(s)
        ret['Content-Type'] = "text/plain"
        return ret
    def json(o):
        print(json.dumps(o))
        return JsonResponse(o,safe=False)
def table(qs:QuerySet,*args):
    md = qs.model
    fields = args if len(args) else [f.name for f in md._meta.fields]
    values = [list(arr) for arr in qs.values_list(*fields)]
    return {'fields':fields,'values':values,'name':str(md._meta.verbose_name)}
def webfn(out=Out.json,inp=Inp.pyargs,post_fn = None):
    def w(fn):
        fn._web_inp = inp
        fn._web_out = out
        if post_fn: fn._web_post = post_fn
        return fn
    return w
# django integration
def route(root,prefix = "/api"):
    @csrf.csrf_exempt
    @http.require_http_methods(['GET','POST','PUT','OPTIONS'])
    def router(r:HttpRequest):
        curr = root
        for name in r.path[len(prefix):].split('/'):
            if name=='':continue
            curr = subs(curr,name,r)
            if curr==None:break
        if not curr:
            return HttpResponseNotFound(f'object wasnt found')
        handler = curr if isinstance(curr,(MethodType,FunctionType)) else getattr(curr,'_web_fn')
        if handler is None: return HttpResponseNotFound(f'handler wasnt found')
        inp = getattr(handler,'_web_inp',Inp.pyargs)
        out = getattr(handler,'_web_out',Out.json)
        post = getattr(handler,'_web_post')
        args = inp(r,handler) if inp else ([r],{})
        if type(args) is not tuple:args = ([args],{})
        ret = handler(*args[0],**args[1])
        if post:ret = post(ret)
        return ret if out is None else out(ret)
    return router
class DJModel:
    def __init__(self,md:Model) -> None:
        self.md = md
    @webfn(post_fn=table)
    def all(self):
        return self.md.objects.all()
    @webfn()
    def new(self,**dct):
        dct.pop('_r')
        obj = self.md(**dct)
        obj.save()
class Djapp():
    def __init__(self,cfg:AppConfig):
        self._web_sub = {md._meta.model_name:DJModel(md) for md in cfg.get_models()}
class webdict(dict):
    def _web_sub(self):return self
class DjangoManager():
    def __init__(self) -> None:
        subs = {}
        for app in apps.get_app_configs():
            name = str(app.verbose_name)
            app = Djapp(app)
            subs[name] = app
        self._web_sub = subs
# setup
def obj_info(o):
    if o is None:return
    ret = {}
    sub = subs(o)
    if len(sub):
        ret['childs'] = {n:obj_info(sub[n]) for n in sub}
    def add_attr(name,df=None):
        attr = getattr(o,f'_web_{name}')
        if attr is not None and attr !=df:
            ret[name] = attr if type(attr) is str else attr.__name__
    add_attr('inp',Inp.pyargs)
    add_attr('out',Out.json)
    add_attr('post')
    return ret