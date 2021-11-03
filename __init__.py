import inspect
import builtins
__bins_storage = {}
def setattr(o,k,v):
    if type(o) is type and o.__module__ in ("builtins",'datetime'):
        if not (o in __bins_storage):
            __bins_storage[o] = {}
        dct = __bins_storage[o]
        dct[k] = v
    else:
        builtins.setattr(o,k,v)
def getattr(instance,key,*args):
    if hasattr(instance,key):return builtins.getattr(instance,key,*args)
    bins = __bins_storage
    for t in inspect.getmro(type(instance)):
        if t in bins and key in bins[t]:
            val = bins[t][key]
            return val.__get__(instance,t) if callable(val) and type(instance) is not type else val
    return args[0] if len(args) else None
def extends(*objs):
    def wrapper(cls):
        d = dict(cls.__dict__)
        for obj in objs:
            for k in d:
                if k in ['__module__','__dict__']:continue
                setattr(obj,k,d[k])
    return wrapper
