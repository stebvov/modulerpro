import { useState, useEffect, useCallback, useRef } from "react";

const SUPABASE_URL = "https://ftxylxurnahpvhwafzrk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0eHlseHVybmFocHZod2FmenJrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzE4MzUsImV4cCI6MjA5NDI0NzgzNX0.JCfvJeAPUDlhkE6gRVJovnZLaTRfwjnXf-PIVAO-b54";

// ─── API ──────────────────────────────────────────────────────────────────────
const H = { "Content-Type":"application/json", "apikey":SUPABASE_KEY, "Authorization":`Bearer ${SUPABASE_KEY}`, "Prefer":"return=representation" };
const sb = {
  async get(t, q="")  { const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?${q}&order=created_at.asc`,{headers:H}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async post(t, d)    { const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}`,{method:"POST",headers:H,body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async patch(t, id, d){ const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?id=eq.${id}`,{method:"PATCH",headers:H,body:JSON.stringify(d)}); if(!r.ok) throw new Error(await r.text()); return r.json(); },
  async del(t, id)    { const r=await fetch(`${SUPABASE_URL}/rest/v1/${t}?id=eq.${id}`,{method:"DELETE",headers:H}); if(!r.ok) throw new Error(await r.text()); return true; },
};

function useTable(table, query="") {
  const [data,setData]=useState([]); const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false); const [error,setError]=useState(null);
  const load=useCallback(async(silent=false)=>{ if(!silent)setLoading(true); try{ const r=await sb.get(table,query); setData(r); setError(null); }catch(e){ setError(e.message); } finally{ setLoading(false); } },[table,query]);
  useEffect(()=>{ load(); const t=setInterval(()=>load(true),20000); return()=>clearInterval(t); },[load]);
  async function create(row){ setSaving(true); try{ const [c]=await sb.post(table,row); setData(p=>[...p,c]); return c; }catch(e){ setError(e.message); }finally{ setSaving(false); } }
  async function update(id,ch){ setSaving(true); setData(p=>p.map(r=>r.id===id?{...r,...ch}:r)); try{ await sb.patch(table,id,ch); }catch(e){ setError(e.message); load(); }finally{ setSaving(false); } }
  async function remove(id){ setSaving(true); setData(p=>p.filter(r=>r.id!==id)); try{ await sb.del(table,id); }catch(e){ setError(e.message); load(); }finally{ setSaving(false); } }
  return {data,loading,saving,error,reload:load,create,update,remove};
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLES = {
  owner:   {label:"Власник",  color:"#f59e0b",emoji:"👑", access:["dashboard","products","costing","procurement","projects","crm","analytics","bom","team","knowledge","settings"]},
  manager: {label:"Менеджер", color:"#6366f1",emoji:"👔", access:["dashboard","products","projects","crm","costing","knowledge"]},
  brigade: {label:"Бригада",  color:"#10b981",emoji:"👷", access:["projects","knowledge"]},
};
const USERS=[
  {id:"u1",name:"Власник",  role:"owner",  pin:"1111"},
  {id:"u2",name:"Менеджер", role:"manager",pin:"2222"},
  {id:"u3",name:"Бригада А",role:"brigade",pin:"3333"},
];
const STAGES=[
  {id:"lead",        label:"Заявка",      color:"#6366f1",emoji:"📥"},
  {id:"design",      label:"Проєкт",      color:"#8b5cf6",emoji:"📐"},
  {id:"purchase",    label:"Закупівля",   color:"#f59e0b",emoji:"🛒"},
  {id:"production",  label:"Виробництво", color:"#3b82f6",emoji:"🏗️"},
  {id:"installation",label:"Монтаж",      color:"#06b6d4",emoji:"🔧"},
  {id:"delivery",    label:"Здача",       color:"#10b981",emoji:"✅"},
  {id:"paid",        label:"Оплачено",    color:"#22c55e",emoji:"💰"},
];
const CRM_STAGES=[
  {id:"new",    label:"Нова заявка", color:"#6366f1"},
  {id:"qualify",label:"Кваліфікація",color:"#8b5cf6"},
  {id:"proposal",label:"КП надіслано",color:"#f59e0b"},
  {id:"contract",label:"Договір",    color:"#3b82f6"},
  {id:"advance", label:"Аванс",      color:"#10b981"},
  {id:"won",     label:"✅ Угода",   color:"#22c55e"},
  {id:"lost",    label:"❌ Відмова", color:"#ef4444"},
];
const ALL_MODULES=[
  {id:"dashboard",  label:"Дашборд",    icon:"◈"},
  {id:"products",   label:"Продукти",   icon:"🏠"},
  {id:"costing",    label:"Калькул.",   icon:"⚡"},
  {id:"procurement",label:"Закупівлі",  icon:"📦"},
  {id:"projects",   label:"Проєкти",    icon:"🏗"},
  {id:"crm",        label:"CRM",        icon:"👥"},
  {id:"analytics",  label:"Аналітика",  icon:"📊"},
  {id:"bom",        label:"Норми/BOM",  icon:"📋"},
  {id:"team",       label:"Команда",    icon:"👷"},
  {id:"knowledge",  label:"База знань", icon:"📚"},
  {id:"settings",   label:"Налашт.",    icon:"⚙️"},
];
// Bottom nav — 6 most used
const BOTTOM_NAV=["dashboard","products","projects","crm","procurement","costing"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt   = n=>Number(n||0).toLocaleString("uk-UA");
const uid   = ()=>Date.now().toString(36)+Math.random().toString(36).slice(2,5);
const dLeft = d=>d?Math.ceil((new Date(d)-new Date())/86400000):999;
const today = ()=>new Date().toISOString().slice(0,10);
const fmtDate = d=>d?new Date(d).toLocaleDateString("uk-UA"):"—";
const daysSince = d=>d?Math.floor((new Date()-new Date(d))/86400000):999;

// ─── UI ───────────────────────────────────────────────────────────────────────
const Card =({children,style={}})=><div style={{background:"#fff",borderRadius:14,padding:"13px 15px",marginBottom:10,boxShadow:"0 1px 8px #00000010",...style}}>{children}</div>;
const Badge=({color,children})=><span style={{fontSize:10,fontWeight:700,color,background:color+"22",padding:"2px 8px",borderRadius:99,whiteSpace:"nowrap"}}>{children}</span>;
const Btn  =({onClick,color="#3b82f6",children,small,outline,full,disabled,style={}})=><button onClick={onClick} disabled={disabled} style={{padding:small?"5px 12px":"9px 18px",background:outline?"transparent":disabled?"#e2e8f0":color,color:outline?color:disabled?"#94a3b8":"#fff",border:outline?`1.5px solid ${color}`:"none",borderRadius:10,fontSize:small?11:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",width:full?"100%":"auto",...style}}>{children}</button>;
const Input=({value,onChange,placeholder,type="text",style={}})=><input type={type} value={value||""} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box",...style}}/>;
const Sel  =({value,onChange,options,style={}})=><select value={value||""} onChange={e=>onChange(e.target.value)} style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,background:"#fff",outline:"none",boxSizing:"border-box",...style}}>{options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>;
const Lbl  =({children})=><div style={{fontSize:10,fontWeight:700,color:"#94a3b8",letterSpacing:"0.08em",marginBottom:4,marginTop:10}}>{children}</div>;
const PBar =({value,color="#3b82f6",height=5})=><div style={{background:"#f1f5f9",borderRadius:99,height,marginTop:5}}><div style={{width:`${Math.min(100,Math.max(0,+value||0))}%`,height:"100%",background:color,borderRadius:99,transition:"width .3s"}}/></div>;
const DL   =({date})=>{ if(!date)return null; const d=dLeft(date),c=d<0?"#ef4444":d<=5?"#f59e0b":"#10b981"; return <Badge color={c}>{d<0?`Прострочено ${Math.abs(d)}д`:d===0?"Сьогодні!":d<999?`${d} дн.`:""}</Badge>; };
const Spin =()=><div style={{display:"flex",alignItems:"center",justifyContent:"center",padding:40,flexDirection:"column",gap:12}}><div style={{width:28,height:28,border:"3px solid #e2e8f0",borderTop:"3px solid #3b82f6",borderRadius:"50%",animation:"spin .8s linear infinite"}}/><style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style><div style={{fontSize:12,color:"#94a3b8"}}>Завантаження...</div></div>;

function Modal({title,onClose,children}){
  return <div style={{position:"fixed",inset:0,background:"#000a",zIndex:1000,display:"flex",alignItems:"flex-end"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:"#fff",borderRadius:"20px 20px 0 0",width:"100%",maxHeight:"93vh",overflowY:"auto",padding:"20px 16px 52px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:16}}>{title}</div>
        <button onClick={onClose} style={{background:"#f1f5f9",border:"none",borderRadius:99,width:32,height:32,fontSize:16,cursor:"pointer"}}>✕</button>
      </div>
      {children}
    </div>
  </div>;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({onLogin}){
  const [sel,setSel]=useState(null),[pin,setPin]=useState(""),[err,setErr]=useState("");
  return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{fontSize:48,marginBottom:8}}>🏗️</div>
    <div style={{fontSize:22,fontWeight:800,color:"#fff",marginBottom:4}}>МОДУЛЕР ПРО</div>
    <div style={{fontSize:10,color:"#22c55e",marginBottom:32,display:"flex",alignItems:"center",gap:6}}>
      <div style={{width:6,height:6,borderRadius:99,background:"#22c55e"}}/> Live · Supabase
    </div>
    {!sel?<>
      <div style={{fontSize:11,color:"#64748b",marginBottom:14,letterSpacing:"0.08em"}}>ОБЕРІТЬ ПРОФІЛЬ</div>
      {USERS.map(u=>{const r=ROLES[u.role];return <button key={u.id} onClick={()=>setSel(u)} style={{width:"100%",maxWidth:320,marginBottom:10,padding:"14px 20px",background:"#1e293b",border:`1.5px solid ${r.color}40`,borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:42,height:42,borderRadius:12,background:r.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{r.emoji}</div>
        <div style={{textAlign:"left"}}><div style={{fontWeight:700,color:"#fff",fontSize:14}}>{u.name}</div><div style={{marginTop:3}}><Badge color={r.color}>{r.label}</Badge></div></div>
      </button>;})}
    </>:<div style={{width:"100%",maxWidth:320}}>
      <button onClick={()=>{setSel(null);setPin("");setErr("");}} style={{background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12,marginBottom:16}}>← Назад</button>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{fontSize:36,marginBottom:6}}>{ROLES[sel.role].emoji}</div>
        <div style={{fontWeight:800,color:"#fff",fontSize:16,marginBottom:6}}>{sel.name}</div>
        <Badge color={ROLES[sel.role].color}>{ROLES[sel.role].label}</Badge>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[1,2,3,4,5,6,7,8,9,"✕",0,"✓"].map((k,i)=><button key={i} onClick={()=>{ if(k==="✕")setPin(p=>p.slice(0,-1)); else if(k==="✓"){if(sel.pin===pin)onLogin(sel);else{setErr("Невірний PIN");setPin("");}} else if(pin.length<4)setPin(p=>p+k); }} style={{padding:"14px",background:k==="✓"?"#3b82f6":k==="✕"?"#ef444420":"#1e293b",border:"none",borderRadius:12,fontSize:k==="✓"||k==="✕"?18:20,fontWeight:700,color:k==="✓"?"#fff":k==="✕"?"#ef4444":"#fff",cursor:"pointer"}}>{k}</button>)}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:12}}>{[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:99,background:i<pin.length?"#3b82f6":"#1e293b",transition:"background .2s"}}/>)}</div>
      {err&&<div style={{color:"#ef4444",textAlign:"center",fontSize:12,marginBottom:8}}>{err}</div>}
      <div style={{textAlign:"center",fontSize:10,color:"#334155"}}>Власник:1111 · Менеджер:2222 · Бригада:3333</div>
    </div>}
  </div>;
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({projects,workers,operations,procurement,onNav}){
  const tSale =projects.reduce((s,p)=>s+ +p.sale_price,0);
  const tSpent=projects.reduce((s,p)=>s+ +p.spent,0);
  const tAdv  =projects.reduce((s,p)=>s+ +p.advance,0);
  const margin=tSale-tSpent;
  const mPct  =tSale>0?Math.round(margin/tSale*100):0;
  const overdue=projects.filter(p=>dLeft(p.deadline)<0&&p.stage!=="paid");
  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const pendingProc=procurement.filter(p=>p.status==="pending").length;

  const kpis=[
    {l:"Активних проєктів", v:projects.filter(p=>p.stage!=="paid").length, c:"#3b82f6", i:"🏗️", nav:"projects"},
    {l:`Маржа (${mPct}%)`,  v:"₴"+fmt(margin), c:mPct>=25?"#10b981":mPct>=15?"#f59e0b":"#ef4444", i:"📈", nav:"analytics"},
    {l:"Праця (1 будинок)", v:"₴"+fmt(laborCost), c:"#06b6d4", i:"👷", nav:"costing"},
    {l:"Закупити позицій",  v:pendingProc, c:pendingProc>0?"#f59e0b":"#10b981", i:"📦", nav:"procurement"},
    {l:"Прострочено",       v:overdue.length, c:overdue.length>0?"#ef4444":"#10b981", i:"⏰", nav:"projects"},
    {l:"Аванси в касі",     v:"₴"+fmt(tAdv), c:"#8b5cf6", i:"💳", nav:"analytics"},
  ];

  const near=[...projects].filter(p=>p.stage!=="paid"&&p.deadline).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,4);

  return <div>
    {overdue.length>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626",fontWeight:600}}>
      🚨 {overdue.length} проєкт(ів) прострочено! <span onClick={()=>onNav("projects")} style={{textDecoration:"underline",cursor:"pointer"}}>Переглянути →</span>
    </div>}

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      {kpis.map((k,i)=><Card key={i} style={{margin:0,padding:"12px 14px",cursor:"pointer",transition:"box-shadow .2s"}} onClick={()=>onNav(k.nav)}>
        <div style={{fontSize:20,marginBottom:4}}>{k.i}</div>
        <div style={{fontSize:15,fontWeight:800,color:k.c}}>{k.v}</div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{k.l}</div>
        <div style={{fontSize:9,color:"#cbd5e1",marginTop:2}}>Тап → перейти</div>
      </Card>)}
    </div>

    <div style={{fontWeight:700,fontSize:11,color:"#64748b",letterSpacing:"0.08em",marginBottom:8}}>АКТИВНІ ПРОЄКТИ</div>
    {near.map(p=>{
      const s=STAGES.find(x=>x.id===p.stage)||STAGES[0];
      const m=+p.sale_price- +p.spent;
      const mPct_=+p.sale_price>0?Math.round(m/+p.sale_price*100):0;
      return <Card key={p.id} style={{cursor:"pointer",margin:"0 0 8px"}} onClick={()=>onNav("projects")}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
            <div style={{fontSize:11,color:"#64748b"}}>👤 {p.client}</div>
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
            <Badge color={s.color}>{s.emoji} {s.label}</Badge>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{display:"flex",gap:6}}>
            <DL date={p.deadline}/>
            <Badge color={mPct_>=25?"#10b981":mPct_>=15?"#f59e0b":"#ef4444"}>Маржа {mPct_}%</Badge>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:s.color}}>{p.progress}%</span>
        </div>
        <PBar value={p.progress} color={s.color}/>
        {p.issues&&<div style={{fontSize:10,color:"#b45309",background:"#fef3c7",borderRadius:6,padding:"3px 8px",marginTop:6}}>⚠️ {p.issues}</div>}
      </Card>;
    })}
    {projects.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Немає проєктів. <span onClick={()=>onNav("projects")} style={{color:"#3b82f6",cursor:"pointer"}}>Додати →</span></div>}
  </div>;
}

// ─── PRODUCTS CATALOG ─────────────────────────────────────────────────────────
function Products({productsH,onNav}){
  const {data:products,loading,saving,create,update,remove}=productsH;
  const [modal,setModal]=useState(null);
  const [view,setView]=useState(null);
  const [form,setForm]=useState(null);

  const STATUS={
    active: {l:"✅ Актуальний", c:"#10b981"},
    draft:  {l:"📝 Чернетка",   c:"#6366f1"},
    archive:{l:"📦 Архів",      c:"#94a3b8"},
  };

  const empty={
    name:"",description:"",model:"3x6",status:"draft",
    sale_price:0,cost_price:0,margin_pct:30,
    notes:"",version:"1.0",valid_date:today(),
  };

  if(loading) return <Spin/>;

  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
      <div style={{fontSize:12,color:"#64748b"}}>{products.filter(p=>p.status==="active").length} актуальних · {products.length} всього</div>
      <Btn onClick={()=>{setForm({...empty});setModal("add");}} small>+ Новий продукт</Btn>
    </div>

    {/* Filter tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {Object.entries(STATUS).map(([k,v])=>{
        const cnt=products.filter(p=>p.status===k).length;
        if(!cnt&&k!=="active") return null;
        return <div key={k} style={{flex:1,background:v.c+"15",borderRadius:10,padding:"6px 8px",textAlign:"center",border:`1px solid ${v.c}30`}}>
          <div style={{fontSize:13,fontWeight:800,color:v.c}}>{cnt}</div>
          <div style={{fontSize:9,color:v.c}}>{v.l}</div>
        </div>;
      })}
    </div>

    {products.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:40,fontSize:13}}>
      Каталог порожній.<br/>Створіть перший продукт або збережіть з Калькуляції.
      <div style={{marginTop:12}}><Btn onClick={()=>onNav("costing")} outline color="#3b82f6" small>⚡ Перейти в Калькуляцію</Btn></div>
    </div>}

    {products.map(p=>{
      const s=STATUS[p.status]||STATUS.draft;
      const margin_=+p.sale_price>0?Math.round((+p.sale_price- +p.cost_price)/+p.sale_price*100):0;
      return <Card key={p.id} style={{borderLeft:`3px solid ${s.c}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:14,color:"#1e293b"}}>{p.name}</div>
            <div style={{fontSize:11,color:"#64748b",marginTop:2}}>v{p.version} · {fmtDate(p.valid_date)}</div>
          </div>
          <div style={{display:"flex",gap:5,marginLeft:8}}>
            <button onClick={()=>setView(p)} style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>👁</button>
            <button onClick={()=>{setForm({...p});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button>
            <button onClick={()=>{
              if(confirm("Копіювати продукт?"))
                create({...p,id:undefined,name:p.name+" (копія)",status:"draft",version:"1.0",created_at:undefined});
            }} style={{background:"#f0fdf4",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>⎘</button>
            <button onClick={()=>confirm("Видалити?")&&remove(p.id)} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button>
          </div>
        </div>

        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          <Badge color={s.c}>{s.l}</Badge>
          <Badge color="#6366f1">📐 {p.model}</Badge>
          <Badge color={margin_>=25?"#10b981":margin_>=15?"#f59e0b":"#ef4444"}>Маржа {margin_}%</Badge>
        </div>

        {p.description&&<div style={{fontSize:12,color:"#64748b",marginBottom:8}}>{p.description}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
          {[
            {l:"Ціна продажу", v:"₴"+fmt(+p.sale_price), c:"#10b981"},
            {l:"Собівартість",  v:"₴"+fmt(+p.cost_price),  c:"#e11d48"},
          ].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
            <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
            <div style={{fontSize:14,fontWeight:800,color:x.c}}>{x.v}</div>
          </div>)}
        </div>

        {/* Status quick change */}
        <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
          {Object.entries(STATUS).map(([k,v])=><button key={k} onClick={()=>update(p.id,{status:k})}
            style={{fontSize:9,padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:p.status===k?700:400,background:p.status===k?v.c:"#f1f5f9",color:p.status===k?"#fff":"#64748b"}}>
            {v.l}
          </button>)}
        </div>
      </Card>;
    })}

    {/* View modal */}
    {view&&<Modal title={view.name} onClose={()=>setView(null)}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>
        <Badge color={STATUS[view.status]?.c||"#94a3b8"}>{STATUS[view.status]?.l}</Badge>
        <Badge color="#6366f1">📐 {view.model}</Badge>
        <Badge color="#94a3b8">v{view.version}</Badge>
        <Badge color="#94a3b8">📅 {fmtDate(view.valid_date)}</Badge>
      </div>
      {view.description&&<div style={{fontSize:13,color:"#475569",marginBottom:14,lineHeight:1.6}}>{view.description}</div>}
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        {[
          {l:"Ціна продажу",   v:"₴"+fmt(+view.sale_price), c:"#10b981", big:true},
          {l:"Собівартість",   v:"₴"+fmt(+view.cost_price),  c:"#f59e0b"},
          {l:"Маржа",          v:"₴"+fmt(+view.sale_price- +view.cost_price), c:"#22c55e"},
        ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<2?"1px solid #ffffff15":"none"}}>
          <span style={{fontSize:11,color:"#94a3b8"}}>{x.l}</span>
          <span style={{fontSize:x.big?20:14,fontWeight:x.big?900:700,color:x.c}}>₴{fmt(x.big?+view.sale_price:x.l==="Собівартість"?+view.cost_price:+view.sale_price- +view.cost_price)}</span>
        </div>)}
      </Card>
      {view.notes&&<div style={{fontSize:12,color:"#64748b",marginTop:8,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{view.notes}</div>}
      <Btn onClick={()=>{ create({...view,id:undefined,name:view.name+" (копія)",status:"draft",version:"1.0",created_at:undefined}); setView(null); }} outline color="#6366f1" full style={{marginTop:12}}>⎘ Зробити копію</Btn>
    </Modal>}

    {/* Add/Edit modal */}
    {modal&&form&&<Modal title={modal==="add"?"Новий продукт":"Редагувати продукт"} onClose={()=>setModal(null)}>
      <Lbl>Назва продукту</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Каркасний 3×6 Стандарт"/>
      <Lbl>Опис</Lbl><Input value={form.description} onChange={v=>setForm(p=>({...p,description:v}))} placeholder="Короткий опис для клієнта"/>
      <Lbl>Модель</Lbl><Sel value={form.model} onChange={v=>setForm(p=>({...p,model:v}))} options={["3x6","4x8","6x9","3x9","4x9","6x12"].map(v=>({v,l:v}))}/>
      <Lbl>Статус</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={Object.entries(STATUS).map(([k,v])=>({v:k,l:v.l}))}/>
      <Lbl>Версія</Lbl><Input value={form.version} onChange={v=>setForm(p=>({...p,version:v}))} placeholder="1.0"/>
      <Lbl>Актуально на дату</Lbl><Input type="date" value={form.valid_date} onChange={v=>setForm(p=>({...p,valid_date:v}))}/>
      <Lbl>Ціна продажу (₴)</Lbl><Input type="number" value={form.sale_price} onChange={v=>setForm(p=>({...p,sale_price:+v}))} placeholder="0"/>
      <Lbl>Собівартість (₴)</Lbl><Input type="number" value={form.cost_price} onChange={v=>setForm(p=>({...p,cost_price:+v}))} placeholder="0"/>
      {+form.sale_price>0&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:"#166534",fontWeight:600}}>
        Маржа: ₴{fmt(+form.sale_price- +form.cost_price)} ({+form.sale_price>0?Math.round((+form.sale_price- +form.cost_price)/+form.sale_price*100):0}%)
      </div>}
      <Lbl>Нотатки / склад</Lbl>
      <textarea value={form.notes||""} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Що входить в продукт, особливості..." style={{width:"100%",minHeight:100,padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:12,lineHeight:1.7,resize:"vertical",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form); setModal(null); }} style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── COSTING ──────────────────────────────────────────────────────────────────
function Costing({workersH,operationsH,materialsH,bomH,productsH}){
  const workers   =workersH.data;
  const operations=operationsH.data;
  const materials =materialsH.data;
  const bom       =bomH.data;
  const [tab,setTab]=useState("summary");
  const [margin,setMargin]=useState(30);
  const [qty,setQty]=useState(1);
  const [expandPhase,setExpandPhase]=useState(null);
  const [opModal,setOpModal]=useState(null);
  const [opForm,setOpForm]=useState(null);
  const [saveModal,setSaveModal]=useState(false);
  const [saveName,setSaveName]=useState("");

  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const matOpt   =bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);
  const matRetail=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.retail_price*i.qty:0);},0);
  const saving   =matRetail-matOpt;
  const overhead =Math.round((laborCost+matOpt)*0.06);
  const cost     =laborCost+matOpt+overhead;
  const price    =Math.round(cost*(1+margin/100));
  const totalHours=operations.reduce((s,o)=>s+o.hours*o.qty,0);
  const phases   =[...new Set(operations.map(o=>o.phase))];

  if(operationsH.loading||materialsH.loading)return <Spin/>;

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["summary","Підсумок"],["phases","Фази"],["materials","Матеріали"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 12px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {tab==="summary"&&<>
      <Card>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>⚙️ Параметри</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><Lbl>Кількість</Lbl><Input type="number" value={qty} onChange={v=>setQty(Math.max(1,+v))}/></div>
          <div><Lbl>Маржа: <strong style={{color:"#10b981"}}>{margin}%</strong></Lbl>
            <input type="range" min="15" max="60" value={margin} onChange={e=>setMargin(+e.target.value)} style={{width:"100%",accentColor:"#10b981",marginTop:8}}/>
          </div>
        </div>
      </Card>

      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:14}}>КАЛЬКУЛЯЦІЯ · {qty} од. · Дерев'яний каркас</div>
        {[
          {l:"🪵 Матеріали (опт)",      v:matOpt*qty,   c:"#f59e0b", sub:`Економія ₴${fmt(saving*qty)} vs роздріб`},
          {l:`👷 Праця (${totalHours}год)`, v:laborCost*qty, c:"#06b6d4", sub:`${operations.length} операцій`},
          {l:"📋 Накладні 6%",          v:overhead*qty,  c:"#8b5cf6"},
          {l:"СОБІВАРТІСТЬ",             v:cost*qty,      c:"#e2e8f0", bold:true},
          {l:`ЦІНА КЛІЄНТУ (${margin}%)`, v:price*qty,   c:"#10b981", big:true},
          {l:"МАРЖА ₴",                  v:(price-cost)*qty, c:"#22c55e", bold:true},
        ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<5?"1px solid #ffffff10":"none"}}>
          <div>
            <div style={{fontSize:x.bold||x.big?12:11,color:x.bold||x.big?"#cbd5e1":"#94a3b8"}}>{x.l}</div>
            {x.sub&&<div style={{fontSize:9,color:"#475569",marginTop:1}}>{x.sub}</div>}
          </div>
          <div style={{fontSize:x.big?22:x.bold?16:14,fontWeight:x.big?900:x.bold?700:600,color:x.c}}>₴{fmt(Math.round(x.v))}</div>
        </div>)}
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <Btn onClick={()=>setSaveModal(true)} color="#10b981" full>💾 Зберегти як продукт</Btn>
        <Btn onClick={()=>{
          const w=window.open("","_blank");
          w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>КП — МОДУЛЕР ПРО</title><style>body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#1e293b}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8fafc;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:12px}td{padding:8px;border-bottom:1px solid #f9fafb;font-size:13px}.price{font-weight:900;color:#10b981;font-size:22px}</style></head><body>
          <h1>🏗️ МОДУЛЕР ПРО — Комерційна пропозиція</h1>
          <p style="color:#64748b;font-size:13px">${new Date().toLocaleDateString("uk-UA")} · Дерев'яний каркас · ${qty} од.</p>
          <table><tr><th>Стаття</th><th>Сума (₴)</th></tr>
          <tr><td>Матеріали (оптові ціни)</td><td>₴${fmt(matOpt*qty)}</td></tr>
          <tr><td>Оплата праці (${totalHours} год)</td><td>₴${fmt(laborCost*qty)}</td></tr>
          <tr><td>Накладні (6%)</td><td>₴${fmt(overhead*qty)}</td></tr>
          <tr><td><strong>Собівартість</strong></td><td><strong>₴${fmt(cost*qty)}</strong></td></tr>
          <tr><td colspan="2" style="text-align:center;padding:16px"><span class="price">Ціна: ₴${fmt(price*qty)}</span></td></tr></table>
          <h3>Схема оплат</h3><p>10% бронювання · 40% старт · 30% коробка · 20% здача</p>
          <p style="color:#94a3b8;font-size:12px;margin-top:30px">МОДУЛЕР ПРО · КП дійсне 14 днів · ${new Date().toLocaleDateString("uk-UA")}</p>
          </body></html>`);
          w.document.close();w.print();
        }} color="#6366f1" full>📄 КП для клієнта (PDF)</Btn>
      </div>
    </>}

    {tab==="phases"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:12,color:"#64748b"}}>Праця: <strong style={{color:"#06b6d4"}}>₴{fmt(laborCost)}</strong> · {totalHours}год</div>
        <Btn onClick={()=>{setOpForm({phase:"",name:"",worker_id:workers[0]?.id||"",hours:0,qty:1,unit:"компл",note:"",sort_order:99});setOpModal("add");}} small color="#06b6d4">+ Операція</Btn>
      </div>
      {phases.map(ph=>{
        const ops=operations.filter(o=>o.phase===ph).sort((a,b)=>a.sort_order-b.sort_order);
        const phCost=ops.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
        const phHours=ops.reduce((s,o)=>s+o.hours*o.qty,0);
        const isOpen=expandPhase===ph;
        return <div key={ph} style={{marginBottom:8}}>
          <button onClick={()=>setExpandPhase(isOpen?null:ph)} style={{width:"100%",background:"#fff",border:"none",borderRadius:12,padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 6px #00000010"}}>
            <div style={{textAlign:"left"}}><div style={{fontWeight:700,fontSize:13}}>{ph}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{ops.length} операцій · {phHours}год</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:700,color:"#06b6d4",fontSize:14}}>₴{fmt(phCost)}</div><div style={{fontSize:12,color:"#94a3b8"}}>{isOpen?"▲":"▼"}</div></div>
          </button>
          {isOpen&&<div style={{background:"#f8fafc",borderRadius:"0 0 12px 12px",padding:"8px 8px 4px"}}>
            {ops.map(op=>{
              const w=workers.find(x=>x.id===op.worker_id);
              const opCost=w?w.rate*op.hours*op.qty:0;
              return <div key={op.id} style={{background:"#fff",borderRadius:10,padding:"8px 12px",marginBottom:6,display:"flex",gap:10}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600}}>{op.name}</div>
                  <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{w?.name||"—"} · ₴{w?.rate}/год · {op.hours}год × {op.qty}</div>
                  {op.note&&<div style={{fontSize:10,color:"#64748b",marginTop:2,fontStyle:"italic"}}>💬 {op.note}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontWeight:700,color:"#06b6d4",fontSize:12}}>₴{fmt(opCost)}</div>
                  <div style={{display:"flex",gap:3,marginTop:4}}>
                    <button onClick={()=>{setOpForm({...op});setOpModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>✏️</button>
                    <button onClick={()=>operationsH.remove(op.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>🗑</button>
                  </div>
                </div>
              </div>;
            })}
          </div>}
        </div>;
      })}
    </>}

    {tab==="materials"&&<>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>BOM шаблон 3×6 · {bom.length} позицій</div>
      {bom.map(item=>{
        const mat=materials.find(m=>m.id===item.material_id);
        if(!mat)return null;
        return <Card key={item.id} style={{padding:"8px 12px",margin:"0 0 6px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600}}>{mat.name}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{item.qty} {mat.unit} · {mat.supplier}</div>
              <div style={{fontSize:10,color:"#64748b"}}>{item.note}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
              <div style={{fontWeight:700,color:"#10b981",fontSize:12}}>₴{fmt(mat.opt_price*item.qty)}</div>
              <div style={{fontSize:9,color:"#94a3b8"}}>роздріб ₴{fmt(mat.retail_price*item.qty)}</div>
            </div>
          </div>
        </Card>;
      })}
    </>}

    {/* Save as product modal */}
    {saveModal&&<Modal title="Зберегти як продукт" onClose={()=>setSaveModal(false)}>
      <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#166534"}}>
        Калькуляція буде збережена як продукт в каталозі.<br/>
        Ціна: <strong>₴{fmt(price)}</strong> · Собівартість: <strong>₴{fmt(cost)}</strong> · Маржа: <strong>{margin}%</strong>
      </div>
      <Lbl>Назва продукту</Lbl>
      <Input value={saveName} onChange={setSaveName} placeholder="Каркасний 3×6 Стандарт"/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setSaveModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          if(!saveName.trim())return;
          await productsH.create({name:saveName,description:"",model:"3x6",status:"draft",sale_price:price,cost_price:cost,margin_pct:margin,notes:`Матеріали: ₴${fmt(matOpt)}\nПраця: ₴${fmt(laborCost)}\nНакладні: ₴${fmt(overhead)}\nГодин: ${totalHours}`,version:"1.0",valid_date:today()});
          setSaveModal(false);setSaveName("");
        }} color="#10b981" style={{flex:2}}>💾 Зберегти в каталог</Btn>
      </div>
    </Modal>}

    {/* Operation modal */}
    {opModal&&opForm&&<Modal title={opModal==="add"?"Нова операція":"Редагувати"} onClose={()=>setOpModal(null)}>
      <Lbl>Фаза</Lbl><Input value={opForm.phase} onChange={v=>setOpForm(p=>({...p,phase:v}))} placeholder="3. Каркас стін"/>
      <Lbl>Назва</Lbl><Input value={opForm.name} onChange={v=>setOpForm(p=>({...p,name:v}))} placeholder="Монтаж стійок"/>
      <Lbl>Виконавець</Lbl><Sel value={opForm.worker_id} onChange={v=>setOpForm(p=>({...p,worker_id:v}))} options={workers.map(w=>({v:w.id,l:`${w.name} — ₴${w.rate}/год`}))}/>
      <Lbl>Годин</Lbl><Input type="number" value={opForm.hours} onChange={v=>setOpForm(p=>({...p,hours:+v}))}/>
      <Lbl>Кількість</Lbl><Input type="number" value={opForm.qty} onChange={v=>setOpForm(p=>({...p,qty:+v}))}/>
      <Lbl>Нотатка</Lbl><Input value={opForm.note} onChange={v=>setOpForm(p=>({...p,note:v}))} placeholder="Деталі..."/>
      {opForm.worker_id&&<div style={{background:"#f0f9ff",borderRadius:10,padding:"10px 12px",marginTop:10,fontSize:12,fontWeight:600,color:"#0369a1"}}>
        💰 Вартість: ₴{fmt((workers.find(w=>w.id===opForm.worker_id)?.rate||0)*opForm.hours*opForm.qty)}
      </div>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setOpModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(opForm.id)await operationsH.update(opForm.id,opForm);else await operationsH.create(opForm);setOpModal(null); }} color="#06b6d4" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── BOM MODULE — FULL EDIT ───────────────────────────────────────────────────
function BOMModule({materialsH,bomH,workersH,operationsH}){
  const {data:materials,loading:mLoad,saving:mSave,create:mCreate,update:mUpdate,remove:mRemove}=materialsH;
  const {data:bom,loading:bLoad}=bomH;
  const {data:workers,saving:wSave,create:wCreate,update:wUpdate,remove:wRemove}=workersH;
  const {data:operations}=operationsH;
  const [tab,setTab]=useState("materials");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [wModal,setWModal]=useState(null);
  const [wForm,setWForm]=useState(null);
  const [histModal,setHistModal]=useState(null);
  const [search,setSearch]=useState("");

  const cats=[...new Set(materials.map(m=>m.category))];
  const filtered=materials.filter(m=>!search||m.name.toLowerCase().includes(search.toLowerCase())||m.supplier?.toLowerCase().includes(search.toLowerCase()));
  const totalBOM=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);

  const emptyMat={category:"Каркас — деревина",name:"",unit:"м.п.",retail_price:0,opt_price:0,supplier:"",min_order:1,note:"",price_updated_at:today()};
  const emptyW={name:"",rate:0,unit:"год",category:"Каркас",note:""};

  // Days since price update warning
  function priceWarning(m){
    if(!m.price_updated_at)return true;
    return daysSince(m.price_updated_at)>30;
  }

  if(mLoad||bLoad)return <Spin/>;

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["materials","Матеріали"],["bom","BOM 3×6"],["workers","Виконавці"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 12px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:12,background:tab===id?"#3b82f6":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── MATERIALS TAB ── */}
    {tab==="materials"&&<>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Пошук матеріалу..." style={{flex:1}}/>
        <Btn onClick={()=>{setForm({...emptyMat});setModal("add");}} small>+</Btn>
      </div>

      {/* Stale price warning */}
      {materials.filter(m=>priceWarning(m)).length>0&&<div style={{background:"#fffbeb",border:"1px solid #fde68a",borderRadius:12,padding:"8px 14px",marginBottom:12,fontSize:11,color:"#b45309"}}>
        ⚠️ {materials.filter(m=>priceWarning(m)).length} матеріалів з ціною не актуалізованою більше 30 днів
      </div>}

      {cats.map(cat=>{
        const mats=filtered.filter(m=>m.category===cat);
        if(!mats.length)return null;
        return <div key={cat} style={{marginBottom:16}}>
          <div style={{fontWeight:700,fontSize:11,color:"#6366f1",letterSpacing:"0.08em",marginBottom:6}}>{cat.toUpperCase()}</div>
          {mats.map(m=><Card key={m.id} style={{padding:"10px 12px",margin:"0 0 6px",borderLeft:priceWarning(m)?"3px solid #f59e0b":"3px solid transparent"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600}}>{m.name}</div>
                <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{m.supplier} · мін.{m.min_order} {m.unit}</div>
                <div style={{fontSize:10,color:priceWarning(m)?"#f59e0b":"#10b981",marginTop:2}}>
                  {priceWarning(m)?"⚠️":"✅"} Ціна актуальна на: {m.price_updated_at?fmtDate(m.price_updated_at):"невідомо"}
                </div>
                {m.note&&<div style={{fontSize:10,color:"#64748b",marginTop:1,fontStyle:"italic"}}>{m.note}</div>}
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                <div style={{fontSize:14,fontWeight:800,color:"#10b981"}}>₴{fmt(m.opt_price)}</div>
                <div style={{fontSize:9,color:"#94a3b8"}}>роздріб ₴{fmt(m.retail_price)}</div>
                <div style={{display:"flex",gap:3,marginTop:6,justifyContent:"flex-end"}}>
                  <button onClick={()=>mUpdate(m.id,{price_updated_at:today()})} style={{background:"#f0fdf4",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}} title="Підтвердити ціну актуальною">✓</button>
                  <button onClick={()=>{setForm({...m});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>✏️</button>
                  <button onClick={()=>mRemove(m.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>🗑</button>
                </div>
              </div>
            </div>
          </Card>)}
        </div>;
      })}
    </>}

    {/* ── BOM TAB ── */}
    {tab==="bom"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:12,color:"#64748b"}}>Всього (опт): <strong style={{color:"#10b981"}}>₴{fmt(totalBOM)}</strong></div>
        <Badge color="#94a3b8">{bom.length} позицій</Badge>
      </div>
      {bom.map(item=>{
        const mat=materials.find(m=>m.id===item.material_id);
        if(!mat)return null;
        return <div key={item.id} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"7px 0",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{flex:1}}><div style={{fontSize:12,fontWeight:600}}>{mat.name}</div><div style={{fontSize:10,color:"#94a3b8"}}>{item.qty} {mat.unit} · {item.note}</div></div>
          <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
            <div style={{fontWeight:700,color:"#f59e0b",fontSize:12}}>₴{fmt(mat.opt_price*item.qty)}</div>
          </div>
        </div>;
      })}
      <div style={{borderTop:"2px solid #e2e8f0",marginTop:8,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontWeight:700,fontSize:13}}>Всього (опт)</span>
        <span style={{fontWeight:800,fontSize:14,color:"#10b981"}}>₴{fmt(totalBOM)}</span>
      </div>
    </>}

    {/* ── WORKERS TAB ── */}
    {tab==="workers"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:12,color:"#64748b"}}>{workers.length} виконавців</div>
        <Btn onClick={()=>{setWForm({...emptyW});setWModal("add");}} small color="#8b5cf6">+ Виконавець</Btn>
      </div>
      {workers.map(w=>{
        const wOps=operations.filter(o=>o.worker_id===w.id);
        const wHours=wOps.reduce((s,o)=>s+o.hours*o.qty,0);
        return <Card key={w.id} style={{padding:"10px 14px",margin:"0 0 8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <div>
              <div style={{fontWeight:700,fontSize:13}}>{w.name}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{w.category} {w.note&&`· ${w.note}`}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontWeight:800,fontSize:16,color:"#8b5cf6"}}>₴{fmt(w.rate)}<span style={{fontSize:10,color:"#94a3b8"}}>/год</span></div>
              {wHours>0&&<div style={{fontSize:10,color:"#06b6d4"}}>{wHours}год в операціях</div>}
            </div>
          </div>
          {w.notes&&<div style={{fontSize:11,color:"#64748b",background:"#f8fafc",borderRadius:8,padding:"4px 8px",marginBottom:6}}>💬 {w.notes}</div>}
          <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
            <button onClick={()=>setHistModal(w)} style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>📝 Коментар</button>
            <button onClick={()=>{setWForm({...w});setWModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>✏️ Ред.</button>
            <button onClick={()=>confirm("Видалити?")&&wRemove(w.id)} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>🗑</button>
          </div>
        </Card>;
      })}
    </>}

    {/* Material modal */}
    {modal&&form&&<Modal title={modal==="add"?"Новий матеріал":"Редагувати матеріал"} onClose={()=>setModal(null)}>
      <Lbl>Категорія</Lbl><Sel value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={["Каркас — деревина","Каркас — кріплення","Плитний матеріал","Утеплення","Мембрани","Скотчі та герметики","Покрівля","Вікна і двері","Електрика","Сантехніка","Внутрішнє оздоблення","Фасад зовнішній"].map(v=>({v,l:v}))}/>
      <Lbl>Назва</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Назва матеріалу"/>
      <Lbl>Одиниця</Lbl><Sel value={form.unit} onChange={v=>setForm(p=>({...p,unit:v}))} options={["м.п.","шт","м²","кг","компл","аркуш","рул","туба","л"].map(v=>({v,l:v}))}/>
      <Lbl>Оптова ціна (₴)</Lbl><Input type="number" value={form.opt_price} onChange={v=>setForm(p=>({...p,opt_price:+v}))} placeholder="0"/>
      <Lbl>Роздрібна ціна (₴)</Lbl><Input type="number" value={form.retail_price} onChange={v=>setForm(p=>({...p,retail_price:+v}))} placeholder="0"/>
      <Lbl>Постачальник</Lbl><Input value={form.supplier} onChange={v=>setForm(p=>({...p,supplier:v}))} placeholder="Назва компанії"/>
      <Lbl>Мін. замовлення</Lbl><Input type="number" value={form.min_order} onChange={v=>setForm(p=>({...p,min_order:+v}))} placeholder="1"/>
      <Lbl>Дата актуалізації ціни</Lbl><Input type="date" value={form.price_updated_at||today()} onChange={v=>setForm(p=>({...p,price_updated_at:v}))}/>
      <Lbl>Нотатка</Lbl><Input value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Технічні характеристики..."/>
      {+form.opt_price>0&&+form.retail_price>0&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:"#166534"}}>
        Економія від опту: ₴{fmt(+form.retail_price - +form.opt_price)} ({Math.round((1-form.opt_price/form.retail_price)*100)}%)
      </div>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await mUpdate(form.id,form);else await mCreate(form);setModal(null); }} style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}

    {/* Worker modal */}
    {wModal&&wForm&&<Modal title={wModal==="add"?"Новий виконавець":"Редагувати виконавця"} onClose={()=>setWModal(null)}>
      <Lbl>Назва (посада)</Lbl><Input value={wForm.name} onChange={v=>setWForm(p=>({...p,name:v}))} placeholder="Тесляр / каркасник"/>
      <Lbl>Категорія</Lbl><Sel value={wForm.category} onChange={v=>setWForm(p=>({...p,category:v}))} options={["Каркас","Утеплення","Покрівля","Фасад","Оздоблення","Комунікації","Загальне","Проєкт","Управління"].map(v=>({v,l:v}))}/>
      <Lbl>Ставка (₴/год)</Lbl><Input type="number" value={wForm.rate} onChange={v=>setWForm(p=>({...p,rate:+v}))} placeholder="150"/>
      <Lbl>Нотатка</Lbl><Input value={wForm.note} onChange={v=>setWForm(p=>({...p,note:v}))} placeholder="Спеціалізація, досвід..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setWModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(wForm.id)await wUpdate(wForm.id,wForm);else await wCreate(wForm);setWModal(null); }} color="#8b5cf6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}

    {/* Worker comment modal */}
    {histModal&&<Modal title={`Коментар: ${histModal.name}`} onClose={()=>setHistModal(null)}>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:8}}>Нотатки, оцінка, особливості роботи</div>
      <textarea defaultValue={histModal.notes||""} id="workerNote" style={{width:"100%",minHeight:120,padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,lineHeight:1.7,resize:"vertical",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:12}}>
        <Btn onClick={()=>setHistModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ await wUpdate(histModal.id,{notes:document.getElementById("workerNote").value}); setHistModal(null); }} color="#8b5cf6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── PROCUREMENT ──────────────────────────────────────────────────────────────
function Procurement({procH,materials,projects}){
  const {data:procurement,loading,saving,create,update,remove}=procH;
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const STATUS={
    pending: {l:"🟡 Замовити",  c:"#f59e0b"},
    ordered: {l:"🔵 Замовлено", c:"#3b82f6"},
    received:{l:"🟢 Отримано",  c:"#10b981"},
    paid:    {l:"✅ Оплачено",  c:"#22c55e"},
  };
  const pendingVal=procurement.filter(p=>p.status==="pending").reduce((s,p)=>{const m=materials.find(x=>x.id===p.material_id);return s+(m?m.opt_price*p.qty:0);},0);
  const orderedVal=procurement.filter(p=>p.status==="ordered").reduce((s,p)=>{const m=materials.find(x=>x.id===p.material_id);return s+(m?m.opt_price*p.qty:0);},0);
  const byStatus=Object.keys(STATUS).map(s=>({...STATUS[s],id:s,items:procurement.filter(p=>p.status===s)})).filter(s=>s.items.length>0);
  if(loading)return <Spin/>;
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {[{l:"Потрібно замовити",v:"₴"+fmt(pendingVal),c:"#f59e0b",i:"🟡"},{l:"В дорозі",v:"₴"+fmt(orderedVal),c:"#3b82f6",i:"🔵"}].map((x,i)=><Card key={i} style={{margin:0,padding:"12px 14px"}}><div style={{fontSize:18,marginBottom:4}}>{x.i}</div><div style={{fontSize:15,fontWeight:800,color:x.c}}>{x.v}</div><div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{x.l}</div></Card>)}
    </div>
    <Btn onClick={()=>{setForm({material_id:materials[0]?.id||"",project_id:projects[0]?.id||"",qty:1,status:"pending",ordered_date:"",expected_date:"",supplier:"",price_paid:0,note:""});setModal("add");}} small full style={{marginBottom:14}}>+ Нова закупівля</Btn>
    {saving&&<div style={{fontSize:11,color:"#3b82f6",textAlign:"center",marginBottom:8}}>⟳ Збереження...</div>}
    {byStatus.map(s=><div key={s.id} style={{marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:s.c+"15",borderRadius:10,borderLeft:`3px solid ${s.c}`}}>
        <span style={{fontWeight:700,color:s.c,fontSize:13}}>{s.l}</span>
        <span style={{marginLeft:"auto",background:s.c,color:"#fff",borderRadius:99,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{s.items.length}</span>
      </div>
      {s.items.map(item=>{
        const mat=materials.find(m=>m.id===item.material_id);
        const proj=projects.find(p=>p.id===item.project_id);
        if(!mat)return null;
        return <Card key={item.id} style={{margin:"0 0 8px",padding:"10px 12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600}}>{mat.name}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{item.qty} {mat.unit} · {item.supplier||mat.supplier}</div>
              {proj&&<div style={{marginTop:4}}><Badge color="#6366f1">🏗 {proj.name.slice(0,25)}</Badge></div>}
              {item.expected_date&&<div style={{marginTop:4}}><DL date={item.expected_date}/></div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
              <div style={{fontWeight:700,color:"#f59e0b",fontSize:13}}>₴{fmt(mat.opt_price*item.qty)}</div>
              <div style={{display:"flex",gap:3,marginTop:6,justifyContent:"flex-end"}}>
                <button onClick={()=>{setForm({...item});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>✏️</button>
                <button onClick={()=>remove(item.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"3px 7px",cursor:"pointer",fontSize:11}}>🗑</button>
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>
            {Object.entries(STATUS).map(([k,v])=><button key={k} onClick={()=>update(item.id,{status:k})} style={{fontSize:9,padding:"2px 7px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:item.status===k?700:400,background:item.status===k?v.c:"#f1f5f9",color:item.status===k?"#fff":"#64748b"}}>{v.l.split(" ")[0]}</button>)}
          </div>
        </Card>;
      })}
    </div>)}
    {procurement.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:30,fontSize:13}}>Список закупівель порожній</div>}
    {modal&&form&&<Modal title={modal==="add"?"Нова закупівля":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Матеріал</Lbl><Sel value={form.material_id} onChange={v=>setForm(p=>({...p,material_id:v}))} options={materials.map(m=>({v:m.id,l:m.name}))}/>
      <Lbl>Проєкт</Lbl><Sel value={form.project_id} onChange={v=>setForm(p=>({...p,project_id:v}))} options={[{v:"",l:"— без проєкту —"},...projects.map(pr=>({v:pr.id,l:pr.name}))]}/>
      <Lbl>Кількість</Lbl><Input type="number" value={form.qty} onChange={v=>setForm(p=>({...p,qty:+v}))}/>
      <Lbl>Статус</Lbl><Sel value={form.status} onChange={v=>setForm(p=>({...p,status:v}))} options={Object.entries(STATUS).map(([k,v])=>({v:k,l:v.l}))}/>
      <Lbl>Постачальник</Lbl><Input value={form.supplier} onChange={v=>setForm(p=>({...p,supplier:v}))} placeholder="Назва"/>
      <Lbl>Дата замовлення</Lbl><Input type="date" value={form.ordered_date} onChange={v=>setForm(p=>({...p,ordered_date:v}))}/>
      <Lbl>Дата отримання</Lbl><Input type="date" value={form.expected_date} onChange={v=>setForm(p=>({...p,expected_date:v}))}/>
      <Lbl>Нотатка</Lbl><Input value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Деталі..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#3b82f6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
function Projects({hook,user}){
  const {data:projects,loading,saving,create,update,remove}=hook;
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const canEdit=user.role!=="brigade";
  const empty={name:"",client:"",phone:"",stage:"lead",deadline:"",sale_price:0,advance:0,spent:0,progress:0,team:"",manager:"",notes:"",issues:"",bom_model:"3x6"};
  const filtered=projects.filter(p=>{
    const ms=filter==="all"||p.stage===filter;
    const mq=!search||p.name?.toLowerCase().includes(search.toLowerCase())||p.client?.toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  });
  if(loading)return <Spin/>;
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <Input value={search} onChange={setSearch} placeholder="🔍 Пошук..." style={{flex:1}}/>
      {canEdit&&<Btn onClick={()=>{setForm({...empty});setModal("add");}} small>+ Новий</Btn>}
    </div>
    <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
      <button onClick={()=>setFilter("all")} style={{flexShrink:0,fontSize:11,padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filter==="all"?"#1e293b":"#e2e8f0",color:filter==="all"?"#fff":"#475569"}}>Всі ({projects.length})</button>
      {STAGES.map(s=>{const c=projects.filter(p=>p.stage===s.id).length;if(!c)return null;return <button key={s.id} onClick={()=>setFilter(s.id)} style={{flexShrink:0,fontSize:11,padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filter===s.id?s.color:"#e2e8f0",color:filter===s.id?"#fff":"#475569"}}>{s.emoji}{s.label}({c})</button>;})}
    </div>
    {saving&&<div style={{fontSize:11,color:"#3b82f6",textAlign:"center",marginBottom:8}}>⟳ Збереження...</div>}
    {filtered.map(p=>{
      const stage=STAGES.find(s=>s.id===p.stage)||STAGES[0];
      const margin=+p.sale_price- +p.spent;
      const mPct=+p.sale_price>0?Math.round(margin/+p.sale_price*100):0;
      return <Card key={p.id} style={{borderLeft:p.issues?`3px solid #f59e0b`:`3px solid ${stage.color}40`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14}}>{p.name}</div><div style={{fontSize:11,color:"#64748b"}}>👤 {p.client} · {p.phone}</div></div>
          {canEdit&&<div style={{display:"flex",gap:5,marginLeft:8}}>
            <button onClick={()=>{setForm({...p});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button>
            <button onClick={()=>confirm("Видалити з бази?")&&remove(p.id)} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button>
          </div>}
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          <Badge color={stage.color}>{stage.emoji} {stage.label}</Badge>
          <DL date={p.deadline}/>
          {p.team&&<Badge color="#6366f1">👷 {p.team}</Badge>}
        </div>
        {p.issues&&<div style={{fontSize:11,color:"#b45309",background:"#fef3c7",borderRadius:8,padding:"4px 10px",marginBottom:8}}>⚠️ {p.issues}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
          {[{l:"Ціна",v:"₴"+fmt(+p.sale_price),c:"#3b82f6"},{l:"Витрати",v:"₴"+fmt(+p.spent),c:"#e11d48"},{l:`Маржа ${mPct}%`,v:"₴"+fmt(margin),c:margin>=0?"#10b981":"#ef4444"}].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px"}}><div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div><div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8",marginBottom:3}}><span>Готовність</span><span style={{fontWeight:700,color:stage.color}}>{p.progress}%</span></div>
        <PBar value={p.progress} color={stage.color}/>
        <div style={{display:"flex",gap:5,marginTop:10,flexWrap:"wrap"}}>
          {STAGES.map(s=><button key={s.id} onClick={()=>update(p.id,{stage:s.id})} style={{fontSize:10,padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:p.stage===s.id?700:400,background:p.stage===s.id?s.color:"#f1f5f9",color:p.stage===s.id?"#fff":"#64748b"}}>{s.emoji}</button>)}
        </div>
        {canEdit&&<div style={{marginTop:8}}>
          <input type="range" min="0" max="100" value={p.progress} onChange={e=>update(p.id,{progress:+e.target.value})} style={{width:"100%",accentColor:stage.color}}/>
        </div>}
      </Card>;
    })}
    {modal&&form&&<Modal title={modal==="add"?"Новий проєкт":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Назва</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Каркасний 3×6 — Локація"/>
      <Lbl>Клієнт</Lbl><Input value={form.client} onChange={v=>setForm(p=>({...p,client:v}))} placeholder="Ім'я Прізвище"/>
      <Lbl>Телефон</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+380..."/>
      <Lbl>Ціна продажу (₴)</Lbl><Input type="number" value={form.sale_price} onChange={v=>setForm(p=>({...p,sale_price:+v}))}/>
      <Lbl>Витрачено (₴)</Lbl><Input type="number" value={form.spent} onChange={v=>setForm(p=>({...p,spent:+v}))}/>
      <Lbl>Аванс (₴)</Lbl><Input type="number" value={form.advance} onChange={v=>setForm(p=>({...p,advance:+v}))}/>
      <Lbl>Етап</Lbl><Sel value={form.stage} onChange={v=>setForm(p=>({...p,stage:v}))} options={STAGES.map(s=>({v:s.id,l:s.emoji+" "+s.label}))}/>
      <Lbl>Дедлайн</Lbl><Input type="date" value={form.deadline||""} onChange={v=>setForm(p=>({...p,deadline:v}))}/>
      <Lbl>Готовність: {form.progress}%</Lbl>
      <input type="range" min="0" max="100" value={form.progress} onChange={e=>setForm(p=>({...p,progress:+e.target.value}))} style={{width:"100%",accentColor:"#3b82f6"}}/>
      <Lbl>Бригада</Lbl><Input value={form.team} onChange={v=>setForm(p=>({...p,team:v}))} placeholder="Бригада А"/>
      <Lbl>Нотатки</Lbl><Input value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Деталі..."/>
      <Lbl>⚠️ Проблема</Lbl><Input value={form.issues} onChange={v=>setForm(p=>({...p,issues:v}))} placeholder="Порожньо = все ок"/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── CRM ──────────────────────────────────────────────────────────────────────
function CRM({hook}){
  const {data:clients,loading,saving,create,update,remove}=hook;
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const pipeline=clients.filter(c=>!["won","lost"].includes(c.stage));
  const pVal=pipeline.reduce((s,c)=>s+ +c.budget,0);
  const empty={name:"",phone:"",email:"",stage:"new",budget:0,source:"Instagram",notes:""};
  if(loading)return <Spin/>;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontSize:12,color:"#64748b"}}>Pipeline: <strong style={{color:"#6366f1"}}>₴{fmt(pVal)}</strong> · {pipeline.length} лідів</div>
      <Btn onClick={()=>{setForm({...empty});setModal("add");}} small color="#6366f1">+ Клієнт</Btn>
    </div>
    {CRM_STAGES.filter(s=>clients.some(c=>c.stage===s.id)).map(stage=>{
      const sc=clients.filter(c=>c.stage===stage.id);
      return <div key={stage.id} style={{marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:stage.color+"15",borderRadius:10,borderLeft:`3px solid ${stage.color}`}}>
          <span style={{fontWeight:700,color:stage.color,fontSize:13}}>{stage.label}</span>
          <span style={{marginLeft:"auto",background:stage.color,color:"#fff",borderRadius:99,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{sc.length}</span>
        </div>
        {sc.map(c=><Card key={c.id} style={{margin:"0 0 8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>{setForm({...c});setModal("edit");}} style={{background:"none",border:"none",cursor:"pointer",fontSize:14}}>✏️</button>
              <button onClick={()=>confirm("Видалити?")&&remove(c.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14}}>🗑</button>
            </div>
          </div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:6}}>{c.phone}{c.email&&` · ${c.email}`}</div>
          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
            {+c.budget>0&&<Badge color="#8b5cf6">💰 ₴{fmt(+c.budget)}</Badge>}
            {c.source&&<Badge color="#06b6d4">📲 {c.source}</Badge>}
          </div>
          {c.notes&&<div style={{fontSize:11,color:"#94a3b8",marginBottom:6}}>💬 {c.notes}</div>}
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {CRM_STAGES.map(s=><button key={s.id} onClick={()=>update(c.id,{stage:s.id})} style={{fontSize:9,padding:"2px 7px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:c.stage===s.id?700:400,background:c.stage===s.id?s.color:"#f1f5f9",color:c.stage===s.id?"#fff":"#64748b"}}>{s.label}</button>)}
          </div>
        </Card>)}
      </div>;
    })}
    {modal&&form&&<Modal title={modal==="add"?"Новий клієнт":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Ім'я</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Ім'я Прізвище"/>
      <Lbl>Телефон</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+380..."/>
      <Lbl>Email</Lbl><Input value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="email@example.com"/>
      <Lbl>Статус</Lbl><Sel value={form.stage} onChange={v=>setForm(p=>({...p,stage:v}))} options={CRM_STAGES.map(s=>({v:s.id,l:s.label}))}/>
      <Lbl>Бюджет (₴)</Lbl><Input type="number" value={form.budget} onChange={v=>setForm(p=>({...p,budget:+v}))}/>
      <Lbl>Джерело</Lbl><Sel value={form.source||"Instagram"} onChange={v=>setForm(p=>({...p,source:v}))} options={["Instagram","Facebook","Google","Referral","Viber","Інше"].map(v=>({v,l:v}))}/>
      <Lbl>Нотатки</Lbl><Input value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#6366f1" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function Analytics({projects,workers,operations,materials,bom}){
  const tSale =projects.reduce((s,p)=>s+ +p.sale_price,0);
  const tSpent=projects.reduce((s,p)=>s+ +p.spent,0);
  const tAdv  =projects.reduce((s,p)=>s+ +p.advance,0);
  const margin=tSale-tSpent;
  const mPct  =tSale>0?Math.round(margin/tSale*100):0;
  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const matOpt=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);
  const matRetail=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.retail_price*i.qty:0);},0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      {[{l:"Загальна виручка",v:"₴"+fmt(tSale),c:"#3b82f6"},{l:"Загальні витрати",v:"₴"+fmt(tSpent),c:"#e11d48"},{l:`Маржа (${mPct}%)`,v:"₴"+fmt(margin),c:mPct>=25?"#10b981":mPct>=15?"#f59e0b":"#ef4444"},{l:"До отримання",v:"₴"+fmt(tSale-tAdv),c:"#f59e0b"}].map((x,i)=><Card key={i} style={{margin:0}}><div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div><div style={{fontSize:16,fontWeight:800,color:x.c}}>{x.v}</div></Card>)}
    </div>
    <Card>
      <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>📊 Маржа по проєктах</div>
      {projects.map(p=>{const m=+p.sale_price-+p.spent;const pct=+p.sale_price>0?Math.round(m/+p.sale_price*100):0;return <div key={p.id} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}><span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"60%",fontWeight:600}}>{p.name}</span><span style={{fontWeight:800,color:pct>=25?"#10b981":pct>=15?"#f59e0b":"#ef4444"}}>{pct}% · ₴{fmt(m)}</span></div><PBar value={pct} color={pct>=25?"#10b981":pct>=15?"#f59e0b":"#ef4444"} height={6}/></div>;})}
    </Card>
    <Card style={{borderLeft:"3px solid #10b981"}}>
      <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>💡 Оптові закупки (BOM 3×6)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {[{l:"Роздріб",v:"₴"+fmt(matRetail),c:"#e11d48"},{l:"Опт",v:"₴"+fmt(matOpt),c:"#10b981"},{l:"Економія",v:"₴"+fmt(matRetail-matOpt),c:"#f59e0b"}].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}><div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div><div style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
      </div>
    </Card>
  </div>;
}

// ─── TEAM ─────────────────────────────────────────────────────────────────────
function Team({hook,projects}){
  const {data:team,loading}=hook;
  if(loading)return <Spin/>;
  return <div>
    {team.map(m=>{
      const proj=m.active_project_id?projects.find(p=>p.id===m.active_project_id):null;
      const r=ROLES[m.role]||ROLES.brigade;
      return <Card key={m.id}>
        <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
          <div style={{width:44,height:44,borderRadius:12,background:r.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{r.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>{m.name}</div>
            <div style={{display:"flex",gap:5,marginTop:3,flexWrap:"wrap"}}>
              <Badge color={r.color}>{r.label}</Badge>
              <Badge color={m.status==="active"?"#10b981":"#94a3b8"}>{m.status==="active"?"🟢 Активний":"⭕ Вільний"}</Badge>
            </div>
            {m.phone&&<div style={{fontSize:11,color:"#64748b",marginTop:5}}>📞 {m.phone}</div>}
            {m.members?.length>0&&<div style={{fontSize:11,color:"#64748b",marginTop:2}}>👥 {m.members.join(", ")}</div>}
            {m.hourly_rate>0&&<div style={{fontSize:11,color:"#8b5cf6",marginTop:2,fontWeight:600}}>💰 ₴{m.hourly_rate}/год</div>}
            {proj&&<div style={{background:"#f0f9ff",borderRadius:8,padding:"6px 10px",marginTop:8}}><div style={{fontSize:10,color:"#0369a1",fontWeight:700,marginBottom:2}}>ПОТОЧНИЙ ПРОЄКТ</div><div style={{fontSize:12,fontWeight:600}}>{proj.name}</div><PBar value={proj.progress} color="#3b82f6"/></div>}
          </div>
        </div>
      </Card>;
    })}
  </div>;
}

// ─── KNOWLEDGE ────────────────────────────────────────────────────────────────
function Knowledge({hook,user}){
  const {data:knowledge,loading,create,update,remove}=hook;
  const [search,setSearch]=useState("");
  const [cat,setCat]=useState("all");
  const [modal,setModal]=useState(null);
  const [view,setView]=useState(null);
  const [form,setForm]=useState(null);
  const canEdit=user.role==="owner";
  const tagC={critical:"#ef4444",important:"#f59e0b",normal:"#10b981"};
  const tagL={critical:"🔴 Критично",important:"🟡 Важливо",normal:"🟢 Норма"};
  const cats=["all",...new Set(knowledge.map(k=>k.category))];
  const filtered=knowledge.filter(k=>{ const mc=cat==="all"||k.category===cat; const mq=!search||k.title?.toLowerCase().includes(search.toLowerCase())||k.content?.toLowerCase().includes(search.toLowerCase()); return mc&&mq; });
  if(loading)return <Spin/>;
  return <div>
    <div style={{display:"flex",gap:8,marginBottom:12}}>
      <Input value={search} onChange={setSearch} placeholder="🔍 Пошук..." style={{flex:1}}/>
      {canEdit&&<Btn onClick={()=>{setForm({category:"Технологія",title:"",content:"",tag:"normal"});setModal("add");}} small color="#8b5cf6">+</Btn>}
    </div>
    <div style={{display:"flex",gap:6,overflowX:"auto",marginBottom:14,paddingBottom:4}}>
      {cats.map(c=><button key={c} onClick={()=>setCat(c)} style={{flexShrink:0,fontSize:11,padding:"4px 12px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:cat===c?"#8b5cf6":"#e2e8f0",color:cat===c?"#fff":"#475569"}}>{c==="all"?"Всі":c}</button>)}
    </div>
    {filtered.map(k=><Card key={k.id} style={{borderLeft:`3px solid ${tagC[k.tag]||"#10b981"}`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
        <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{k.title}</div><div style={{display:"flex",gap:5}}><Badge color="#8b5cf6">{k.category}</Badge><Badge color={tagC[k.tag]}>{tagL[k.tag]}</Badge></div></div>
        <div style={{display:"flex",gap:5,marginLeft:8}}>
          <button onClick={()=>setView(k)} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>👁</button>
          {canEdit&&<><button onClick={()=>{setForm({...k});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button><button onClick={()=>confirm("Видалити?")&&remove(k.id)} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button></>}
        </div>
      </div>
      <div style={{fontSize:11,color:"#94a3b8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{k.content?.split("\n")[0]}</div>
    </Card>)}
    {view&&<Modal title={view.title} onClose={()=>setView(null)}><div style={{display:"flex",gap:6,marginBottom:12}}><Badge color="#8b5cf6">{view.category}</Badge><Badge color={tagC[view.tag]}>{tagL[view.tag]}</Badge></div><div style={{fontSize:13,lineHeight:1.8,color:"#1e293b",whiteSpace:"pre-wrap"}}>{view.content}</div></Modal>}
    {modal&&form&&<Modal title={modal==="add"?"Нова стаття":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Категорія</Lbl><Sel value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={["Технологія","Продажі","Фінанси","Монтаж","Клієнти","HR"].map(v=>({v,l:v}))}/>
      <Lbl>Заголовок</Lbl><Input value={form.title} onChange={v=>setForm(p=>({...p,title:v}))} placeholder="Назва"/>
      <Lbl>Пріоритет</Lbl><Sel value={form.tag} onChange={v=>setForm(p=>({...p,tag:v}))} options={[{v:"critical",l:"🔴 Критично"},{v:"important",l:"🟡 Важливо"},{v:"normal",l:"🟢 Норма"}]}/>
      <Lbl>Зміст</Lbl>
      <textarea value={form.content} onChange={e=>setForm(p=>({...p,content:e.target.value}))} style={{width:"100%",minHeight:160,padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:12,lineHeight:1.7,resize:"vertical",fontFamily:"inherit",outline:"none",boxSizing:"border-box"}}/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#8b5cf6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({user,onLogout}){
  return <div>
    <Card style={{textAlign:"center",padding:"24px 16px"}}>
      <div style={{fontSize:48,marginBottom:8}}>{ROLES[user.role].emoji}</div>
      <div style={{fontWeight:800,fontSize:18,marginBottom:4}}>{user.name}</div>
      <Badge color={ROLES[user.role].color}>{ROLES[user.role].label}</Badge>
    </Card>
    <Card style={{borderLeft:"3px solid #22c55e"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>☁️ Supabase · Підключено</div>
      <div style={{fontSize:11,color:"#64748b",lineHeight:1.8}}>
        <div>URL: ftxylxurnahpvhwafzrk.supabase.co</div>
        <div>Статус: <span style={{color:"#22c55e",fontWeight:700}}>● Live</span></div>
        <div>Оновлення: кожні 20 секунд</div>
      </div>
    </Card>
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>🔐 Рівні доступу</div>
      {Object.entries(ROLES).map(([k,r])=><div key={k} style={{display:"flex",alignItems:"center",gap:12,padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
        <span style={{fontSize:20}}>{r.emoji}</span>
        <div style={{flex:1}}><div style={{fontWeight:600,fontSize:12}}>{r.label}</div><div style={{fontSize:10,color:"#94a3b8"}}>{r.access.slice(0,5).join(" · ")}</div></div>
        <Badge color={r.color}>PIN</Badge>
      </div>)}
    </Card>
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>📋 v7 — Що нового</div>
      {["✅ Нижнє меню — всі модулі","✅ Верхнє меню прибрано","✅ Дашборд — картки клікабельні","✅ Матеріали — повне редагування","✅ Виконавці — CRUD + коментарі","✅ Актуалізація цін з датою","✅ Каталог продуктів","✅ Збереження калькуляцій","✅ Копіювання / архівування продуктів"].map((f,i)=><div key={i} style={{fontSize:12,color:"#475569",padding:"3px 0",borderBottom:"1px solid #f1f5f9"}}>{f}</div>)}
    </Card>
    <Btn onClick={onLogout} color="#ef4444" outline full>🚪 Вийти</Btn>
  </div>;
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App(){
  const workersH   =useTable("workers");
  const operationsH=useTable("operations","order=sort_order.asc");
  const materialsH =useTable("materials");
  const bomH       =useTable("bom_templates");
  const projectsH  =useTable("projects");
  const clientsH   =useTable("clients");
  const procH      =useTable("procurement");
  const knowledgeH =useTable("knowledge");
  const teamH      =useTable("team_members");
  const productsH  =useTable("products");

  const [user,setUser]    =useState(null);
  const [module,setModule]=useState("dashboard");

  // Need products table in Supabase — create if missing
  const [dbError,setDbError]=useState(null);
  useEffect(()=>{
    const errs=[workersH,materialsH,projectsH].map(h=>h.error).filter(Boolean);
    setDbError(errs[0]||null);
  },[workersH.error,materialsH.error,projectsH.error]);

  if(!user)return <Login onLogin={u=>{setUser(u);setModule("dashboard");}}/>;

  const role   =ROLES[user.role];
  const visible=ALL_MODULES.filter(m=>role.access.includes(m.id));
  const active =visible.find(m=>m.id===module)||visible[0];
  const bottomModules=ALL_MODULES.filter(m=>BOTTOM_NAV.includes(m.id)&&role.access.includes(m.id));
  const overdue=projectsH.data.filter(p=>dLeft(p.deadline)<0&&p.stage!=="paid").length;
  const anySaving=[workersH,operationsH,materialsH,projectsH,clientsH,procH,knowledgeH,productsH].some(h=>h.saving);

  function nav(id){ if(role.access.includes(id))setModule(id); }

  return <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'Helvetica Neue',system-ui,sans-serif",maxWidth:480,margin:"0 auto"}}>

    {dbError&&<div style={{position:"fixed",top:0,left:0,right:0,background:"#ef4444",color:"#fff",padding:"8px 16px",fontSize:11,zIndex:9999,textAlign:"center"}}>
      ⚠️ Помилка БД: {dbError.slice(0,80)}
    </div>}

    {/* HEADER — тільки назва і статус, без меню */}
    <div style={{background:"#0f172a",padding:"14px 16px 12px",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <div style={{fontSize:16,fontWeight:800,color:"#fff"}}>🏗️ МОДУЛЕР ПРО</div>
          <div style={{fontSize:10,color:"#475569"}}>{role.emoji} {user.name} · {active.label}</div>
        </div>
        <div style={{display:"flex",gap:5}}>
          {overdue>0&&<div style={{background:"#ef444420",color:"#ef4444",borderRadius:99,padding:"3px 8px",fontSize:10,fontWeight:700}}>⏰{overdue}</div>}
          <div style={{background:"#1e293b",borderRadius:99,padding:"3px 8px",fontSize:10,color:anySaving?"#f59e0b":"#22c55e"}}>
            {anySaving?"⟳":"☁️"} {anySaving?"Sync":"Live"}
          </div>
          {/* More menu for non-bottom modules */}
          <button onClick={()=>setModule(module==="more"?"dashboard":"more")} style={{background:"#1e293b",border:"none",borderRadius:99,padding:"3px 10px",fontSize:10,color:"#94a3b8",cursor:"pointer"}}>≡ Ще</button>
        </div>
      </div>
    </div>

    {/* MORE MENU */}
    {module==="more"&&<div style={{background:"#1e293b",padding:"8px 16px 16px"}}>
      <div style={{fontSize:10,color:"#64748b",letterSpacing:"0.08em",marginBottom:10,marginTop:4}}>УСІ МОДУЛІ</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        {visible.map(m=><button key={m.id} onClick={()=>setModule(m.id)} style={{background:active.id===m.id?"#3b82f6":"#0f172a",border:"none",borderRadius:10,padding:"10px 6px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:4}}>
          <span style={{fontSize:20}}>{m.icon}</span>
          <span style={{fontSize:9,color:active.id===m.id?"#fff":"#64748b",fontWeight:active.id===m.id?700:400,textAlign:"center"}}>{m.label}</span>
        </button>)}
      </div>
    </div>}

    {/* CONTENT */}
    <div style={{padding:"16px 14px 100px"}}>
      {module!=="more"&&<div style={{fontWeight:800,fontSize:17,color:"#1e293b",marginBottom:14}}>{active.icon} {active.label}</div>}
      {module==="dashboard"   && <Dashboard   projects={projectsH.data} workers={workersH.data} operations={operationsH.data} procurement={procH.data} onNav={nav}/>}
      {module==="products"    && <Products    productsH={productsH} onNav={nav}/>}
      {module==="costing"     && <Costing     workersH={workersH} operationsH={operationsH} materialsH={materialsH} bomH={bomH} productsH={productsH}/>}
      {module==="procurement" && <Procurement procH={procH} materials={materialsH.data} projects={projectsH.data}/>}
      {module==="projects"    && <Projects    hook={projectsH} user={user}/>}
      {module==="crm"         && <CRM         hook={clientsH}/>}
      {module==="analytics"   && <Analytics   projects={projectsH.data} workers={workersH.data} operations={operationsH.data} materials={materialsH.data} bom={bomH.data}/>}
      {module==="bom"         && <BOMModule   materialsH={materialsH} bomH={bomH} workersH={workersH} operationsH={operationsH}/>}
      {module==="team"        && <Team        hook={teamH} projects={projectsH.data}/>}
      {module==="knowledge"   && <Knowledge   hook={knowledgeH} user={user}/>}
      {module==="settings"    && <Settings    user={user} onLogout={()=>setUser(null)}/>}
    </div>

    {/* BOTTOM NAV — 6 основних модулів */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#0f172a",borderTop:"1px solid #1e293b",display:"flex"}}>
      {bottomModules.map(m=><button key={m.id} onClick={()=>setModule(m.id)} style={{flex:1,padding:"9px 2px 12px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:15}}>{m.icon}</span>
        <span style={{fontSize:8,color:active.id===m.id?"#3b82f6":"#475569",fontWeight:active.id===m.id?700:400}}>{m.label}</span>
      </button>)}
      <button onClick={()=>setModule("more")} style={{flex:1,padding:"9px 2px 12px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:15}}>≡</span>
        <span style={{fontSize:8,color:module==="more"?"#3b82f6":"#475569",fontWeight:module==="more"?700:400}}>Ще</span>
      </button>
    </div>
  </div>;
}
