import json
from typing import Union
from django import http
from django.db.models.base import Model
from django.http.request import HttpRequest
from django.http.response import HttpResponseNotAllowed, HttpResponseNotFound, JsonResponse
from django.urls import path
from django.forms.models import model_to_dict
from django.views.decorators import csrf,http
from django.db.models.query import QuerySet
def table(qs,*args):
    isInst = isinstance(qs,Model)
    md = qs.__class__ if isInst else qs.model
    pk = md._meta.pk
    fields = args if len(args) else [f.name for f in md._meta.fields if f !=pk]
    values = None
    if isInst:values = {qs.id:list(model_to_dict(qs,fields=fields).values())}
    else:values = {arr[0]:list(arr[1:]) for arr in qs.values_list(pk.name,*fields)}
    return {'fields':fields,'values':values,'$t':str(md.__name__)}
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
            # get method
            method = getattr(type,method,None)
            if method is None:return HttpResponseNotFound(f'{type}.{method} doesnt exist')
            # get addons
            handlers = getattr(method,'_web_handlers',None)
            if handlers is None: return HttpResponseNotAllowed(f'{type}.{method}')
            # call addons (security,setup args)
            opts = {'args':[json.loads(r.body or "null")],'allowed':True}
            for handler in handlers:handler(opts,r,type,method)
            if not opts['allowed']:return HttpResponseNotAllowed(f'{type}.{method}')
            # return dumped result
            return JsonResponse(method(*opts['args']),safe=False)
        return path(self.prefix+"/<str:type>/<str:method>",methodView)
def web(*handlers):
    def wrp(fn):
        fn._web_handlers=handlers
        return fn
    return wrp
def extends(*objs):
    def wrapper(cls):
        d = dict(cls.__dict__)
        for obj in objs:
            for k in d:
                if k in ['__module__','__dict__']:continue
                setattr(obj,k,d[k])
    return wrapper
# handlers
def inst(opts,r,type:Model,meth):
    [id,args] = opts['args'][0]
    self = type.objects.get(id=id)
    opts['args'] = [self,args]
def req(o,r,t,m):
    o['args'].append(r)
def super_user(o,r:HttpRequest,t,m):
    if not r.user or not r.user.is_superuser:o['allowed'] = False
def logined(o,r:HttpRequest,t,m):
    if not r.user.is_authenticated: o['allowed'] = False 
#extensions
@extends(Model)
class _Model:
    @classmethod
    @web()
    def all(cls,o):
        return table(cls.objects.all())
    @web(inst)
    def update(self:Model,o):
        if 'id' in o:del o['id']
        q = self.__class__.objects.filter(id=self.id)
        q.update(**o)
        return table(q)