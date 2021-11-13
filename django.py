import json
from django import http
from django.http.request import HttpRequest
from django.http.response import HttpResponseNotAllowed, HttpResponseNotFound, JsonResponse
from django.urls import path
from django.views.decorators import csrf,http
from django.db.models.query import QuerySet
def table(qs:QuerySet,*args):
    md = qs.model
    pk = md._meta.pk
    fields = args if len(args) else [f.name for f in md._meta.fields if f !=pk]
    values = {arr[0]:list(arr[1:]) for arr in qs.values_list(pk.name,*fields)}
    return {'fields':fields,'values':values,'type':str(md.__name__)}
class Server:
    prefix="api"
    types={}
    @classmethod
    def route(self):
        @csrf.csrf_exempt
        @http.require_http_methods(['POST'])
        def methodView(r:HttpRequest,type,method):
            type = self.types.get(type)
            if type is None:return HttpResponseNotFound(f'type {type} wasnt found')
            handler = getattr(type,method,None)
            if handler is None:return HttpResponseNotFound(f'{type}.{method} doesnt exist')
            if getattr(handler,'_web_allowed',False) != True: return HttpResponseNotAllowed(f'{type}.{method}')
            return JsonResponse(handler(json.loads(r.body or "null"),r),safe=False)
        return path(self.prefix+"/<str:type>/<str:method>",methodView)
def web(fn):
    fn._web_allowed=True
    return fn
def extends(*objs):
    def wrapper(cls):
        d = dict(cls.__dict__)
        for obj in objs:
            for k in d:
                if k in ['__module__','__dict__']:continue
                setattr(obj,k,d[k])
    return wrapper