'use client';
import {useState,useEffect,useRef} from 'react';
import {LoaderCircle,X,Info} from 'lucide-react';
export async function api<T=any>(path:string,method='GET',data?:unknown):Promise<T>{const r=await fetch(`/api/${path}`,{method,headers:data instanceof FormData?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:data instanceof FormData?data:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw new Error(value.error||'Не удалось выполнить действие');return value;}
export function useData<T=any>(path:string,refresh=0){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);useEffect(()=>{let active=true;setLoading(true);setError('');api<T>(path).then(v=>active&&setData(v)).catch(e=>active&&setError(e.message)).finally(()=>active&&setLoading(false));return()=>{active=false;};},[path,refresh]);return {data,error,loading};}
export function Message({children,error=false}:{children:React.ReactNode;error?:boolean}){return children?<div role={error?'alert':'status'} className={`message ${error?'error':'success'}`}>{children}</div>:null;}
export function Busy(){return <div className="loading" role="status"><LoaderCircle className="spin" size={20}/> Загрузка</div>;}
export function Field({label,hint,...props}:React.InputHTMLAttributes<HTMLInputElement>&{label:string;hint?:string}){return <label className="field"><span>{label}{hint&&<span className="tooltip" tabIndex={0} aria-label={hint}><Info size={14}/><span className="tooltip-content">{hint}</span></span>}</span><input {...props}/></label>;}
export function TextField({label,...props}:React.TextareaHTMLAttributes<HTMLTextAreaElement>&{label:string}){return <label className="field"><span>{label}</span><textarea rows={3} {...props}/></label>;}
export function Select({label,children,...props}:React.SelectHTMLAttributes<HTMLSelectElement>&{label:string}){return <label className="field"><span>{label}</span><select {...props}>{children}</select></label>;}
export function IconButton({label,children,...props}:React.ButtonHTMLAttributes<HTMLButtonElement>&{label:string}){return <button className="icon-button" aria-label={label} title={label} {...props}>{children}</button>;}
export function Modal({title,children,onClose}:{title:string;children:React.ReactNode;onClose:()=>void}){
 const modal=useRef<HTMLElement>(null);
 const close=useRef(onClose);
 useEffect(()=>{close.current=onClose;},[onClose]);
 // Focus belongs to the dialog's lifetime, not to each form update.
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape')close.current();
   if(e.key==='Tab'){
    const elements=Array.from(modal.current?.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href]')||[]).filter(element=>!element.hasAttribute('disabled')&&element.tabIndex>=0&&element.getClientRects().length>0);
    const first=elements[0],last=elements.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
   }
  };
  document.addEventListener('keydown',key);
  modal.current?.querySelector<HTMLElement>('button')?.focus();
  return()=>{document.removeEventListener('keydown',key);if(previous?.isConnected)previous.focus();};
 },[]);
 return <div className="modal-backdrop" onClick={onClose}><section ref={modal} className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e=>e.stopPropagation()}><header><h2>{title}</h2><IconButton label="Закрыть" onClick={onClose}><X size={20}/></IconButton></header>{children}</section></div>;
}
export function Empty({title,children}:{title:string;children?:React.ReactNode}){return <div className="empty"><h3>{title}</h3>{children}</div>;}
