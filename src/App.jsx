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

// ─── PWA ─────────────────────────────────────────────────────────────────────
// Add to index.html: <meta name="apple-mobile-web-app-capable" content="yes">
// <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
// <link rel="manifest" href="/manifest.json">

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ROLES = {
  owner:   {label:"Власник",  color:"#f59e0b",emoji:"👑", access:["dashboard","configurator","products","costing","procurement","projects","crm","analytics","finance","suppliers","bom","team","knowledge","settings"]},
  manager: {label:"Менеджер", color:"#6366f1",emoji:"👔", access:["dashboard","configurator","products","projects","crm","costing","analytics","finance","suppliers","knowledge"]},
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
  {id:"dashboard",    label:"Дашборд",    icon:"◈"},
  {id:"configurator", label:"Конфігур.",  icon:"🔧"},
  {id:"products",     label:"Продукти",   icon:"🏠"},
  {id:"costing",      label:"Калькул.",   icon:"⚡"},
  {id:"procurement",  label:"Закупівлі",  icon:"📦"},
  {id:"projects",     label:"Проєкти",    icon:"🏗"},
  {id:"crm",          label:"CRM",        icon:"👥"},
  {id:"analytics",    label:"Аналітика",  icon:"📊"},
  {id:"finance",      label:"Фінанси",    icon:"💰"},
  {id:"suppliers",    label:"Постачальн.",icon:"🏭"},
  {id:"bom",          label:"Норми/BOM",  icon:"📋"},
  {id:"team",         label:"Команда",    icon:"👷"},
  {id:"knowledge",    label:"База знань", icon:"📚"},
  {id:"settings",     label:"Налашт.",    icon:"⚙️"},
];
// Bottom nav — 6 most used
const BOTTOM_NAV=["dashboard","configurator","projects","crm","analytics","finance"];

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
function Login({onLogin,teamMembers}){
  const [sel,setSel]=useState(null);
  const [pin,setPin]=useState("");
  const [err,setErr]=useState("");
  const [brigadeMode,setBrigadeMode]=useState(false); // вибір члена бригади

  const brigadeMembers=teamMembers.filter(m=>m.role==="brigade"&&m.status==="active");

  function tryLogin(){
    // Перевірка персонального PIN виконавця
    const personal=teamMembers.find(m=>m.personal_pin===pin);
    if(personal){
      onLogin({id:personal.id,name:personal.name,role:"brigade",specialization:personal.specialization,pin});
      return;
    }
    // Стандартні PIN
    if(sel?.pin===pin){
      if(sel.role==="brigade"){
        // Загальний PIN бригади → вибір імені
        setBrigadeMode(true);
        setPin("");
      } else {
        onLogin(sel);
      }
    } else {
      setErr("Невірний PIN");
      setPin("");
    }
  }

  // Вибір конкретного члена бригади
  if(brigadeMode) return <div style={{minHeight:"100vh",background:"#0f172a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
    <div style={{fontSize:40,marginBottom:8}}>👷</div>
    <div style={{fontSize:18,fontWeight:800,color:"#fff",marginBottom:4}}>Хто ти?</div>
    <div style={{fontSize:11,color:"#64748b",marginBottom:24}}>Оберіть своє ім'я</div>
    <div style={{width:"100%",maxWidth:320}}>
      {brigadeMembers.map(m=><button key={m.id} onClick={()=>onLogin({id:m.id,name:m.name,role:"brigade",specialization:m.specialization||"Бригадир",pin:"3333"})}
        style={{width:"100%",marginBottom:10,padding:"14px 20px",background:"#1e293b",border:"1.5px solid #10b98140",borderRadius:14,cursor:"pointer",display:"flex",alignItems:"center",gap:14}}>
        <div style={{width:40,height:40,borderRadius:12,background:"#10b98120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
          {SPEC_EMOJI[m.specialization]||"👷"}
        </div>
        <div style={{textAlign:"left"}}>
          <div style={{fontWeight:700,color:"#fff",fontSize:14}}>{m.name}</div>
          <div style={{fontSize:11,color:"#10b981",marginTop:2}}>{m.specialization||"Бригада"}</div>
        </div>
      </button>)}
      <button onClick={()=>{setBrigadeMode(false);setSel(null);}} style={{width:"100%",background:"none",border:"none",color:"#64748b",cursor:"pointer",fontSize:12,marginTop:8}}>← Назад</button>
    </div>
  </div>;

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
        {sel.role==="brigade"&&<div style={{fontSize:10,color:"#64748b",marginTop:8}}>або особистий PIN виконавця</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:16}}>
        {[1,2,3,4,5,6,7,8,9,"✕",0,"✓"].map((k,i)=><button key={i} onClick={()=>{
          if(k==="✕")setPin(p=>p.slice(0,-1));
          else if(k==="✓")tryLogin();
          else if(pin.length<4)setPin(p=>p+k);
        }} style={{padding:"14px",background:k==="✓"?"#3b82f6":k==="✕"?"#ef444420":"#1e293b",border:"none",borderRadius:12,fontSize:k==="✓"||k==="✕"?18:20,fontWeight:700,color:k==="✓"?"#fff":k==="✕"?"#ef4444":"#fff",cursor:"pointer"}}>{k}</button>)}
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:12}}>{[0,1,2,3].map(i=><div key={i} style={{width:12,height:12,borderRadius:99,background:i<pin.length?"#3b82f6":"#1e293b",transition:"background .2s"}}/>)}</div>
      {err&&<div style={{color:"#ef4444",textAlign:"center",fontSize:12,marginBottom:8}}>{err}</div>}
      <div style={{textAlign:"center",fontSize:10,color:"#334155"}}>Власник:1111 · Менеджер:2222 · Бригада:3333</div>
    </div>}
  </div>;
}

// ─── BRIGADE VIEW — окремий інтерфейс для бригади ────────────────────────────
const SPEC_EMOJI={
  "Тесляр / каркасник":   "🪚",
  "Покрівельник":          "🏠",
  "Утеплювач":             "🧱",
  "Фасадник":              "🎨",
  "Електрик":              "⚡",
  "Сантехнік":             "🔧",
  "Оздоблювач":            "🖌️",
  "Плитка / оздоблення":  "🪟",
  "Різнороб":              "🔨",
  "Бригадир":              "👷",
  "Менеджер":              "👔",
  "Власник":               "👑",
};

const SPEC_CATEGORIES={
  "Тесляр / каркасник":   ["Каркас","Платформа","Загальне"],
  "Покрівельник":          ["Покрівля","Загальне"],
  "Утеплювач":             ["Утеплення","Мембрани","Загальне"],
  "Фасадник":              ["Фасад","Загальне"],
  "Електрик":              ["Електрика","Загальне"],
  "Сантехнік":             ["Сантехніка","Загальне"],
  "Оздоблювач":            ["Оздоблення","Загальне"],
  "Плитка / оздоблення":  ["Оздоблення","Плитка","Загальне"],
  "Різнороб":              ["Загальне"],
  "Бригадир":              ["Каркас","Покрівля","Утеплення","Мембрани","Фасад","Електрика","Сантехніка","Оздоблення","Плитка","Загальне","Логістика"],
};

// Які статті бази знань бачить кожна спеціалізація
const SPEC_KNOWLEDGE={
  "Тесляр / каркасник":   ["Технологія","Виробництво"],
  "Покрівельник":          ["Технологія"],
  "Утеплювач":             ["Технологія"],
  "Фасадник":              ["Технологія"],
  "Електрик":              ["Технологія","Монтаж"],
  "Сантехнік":             ["Технологія","Монтаж"],
  "Оздоблювач":            ["Технологія","Монтаж"],
  "Різнороб":              ["Технологія"],
  "Бригадир":              ["Технологія","Виробництво","Монтаж","Фінанси"],
};

function BrigadeView({member,projects,tasks,comments,knowledge,procurement,materials,onLogout,tasksH,commentsH,teamH,projectMembers}){
  const [tab,setTab]=useState("tasks");
  const [selProject,setSelProject]=useState(null);
  const [pinModal,setPinModal]=useState(false);
  const [newPin,setNewPin]=useState("");
  const [newPin2,setNewPin2]=useState("");
  const [pinStep,setPinStep]=useState(1); // 1=новий PIN, 2=підтвердження
  const [pinErr,setPinErr]=useState("");

  // Проєкти цього члена команди — через project_members або задачі
  const myProjectIds=new Set([
    ...(projectMembers||[]).filter(pm=>pm.member_id===member.id).map(pm=>pm.project_id),
    ...tasks.filter(t=>t.assignee===member.name).map(t=>t.project_id),
  ]);
  const myProjects=projects.filter(p=>myProjectIds.has(p.id)&&p.stage!=="paid");

  const myProject=selProject||myProjects[0];

  // Категорії задач по спеціалізації
  const myCategories=SPEC_CATEGORIES[member.specialization]||["Загальне"];

  // Задачі цього виконавця на поточному проєкті
  const myTasks=myProject?tasks.filter(t=>
    t.project_id===myProject.id&&
    (t.assignee===member.name||myCategories.includes(t.category)||t.assignee==="Бригада")
  ):[];
  const openTasks=myTasks.filter(t=>!t.done).length;

  // Матеріали для доставки на проєкт
  const myMaterials=myProject?procurement.filter(p=>
    p.project_id===myProject.id&&p.status!=="paid"
  ):[];

  // База знань по спеціалізації
  const myKnowledge=knowledge.filter(k=>
    (SPEC_KNOWLEDGE[member.specialization]||[]).includes(k.category)||
    k.tag==="critical"
  );

  // Лог проєкту
  const myComments=myProject?[...comments].filter(c=>c.project_id===myProject.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10):[];

  const prioC={critical:"#ef4444",high:"#f59e0b",medium:"#3b82f6",low:"#94a3b8"};
  const prioL={critical:"🔴",high:"🟡",medium:"🔵",low:"⚪"};
  const stage=myProject?STAGES.find(s=>s.id===myProject.stage)||STAGES[0]:null;

  const [newComment,setNewComment]=useState("");

  return <div style={{minHeight:"100vh",background:"#f0f4f8",fontFamily:"'Helvetica Neue',system-ui,sans-serif",maxWidth:480,margin:"0 auto"}}>

    {/* ХЕДЕР БРИГАДИ */}
    <div style={{background:"#0f172a",padding:"14px 16px 12px",position:"sticky",top:0,zIndex:100}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:40,height:40,borderRadius:12,background:"#10b98120",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>
            {SPEC_EMOJI[member.specialization]||"👷"}
          </div>
          <div>
            <div style={{fontWeight:800,color:"#fff",fontSize:15}}>{member.name}</div>
            <div style={{fontSize:10,color:"#10b981"}}>{member.specialization}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {openTasks>0&&<div style={{background:"#f59e0b20",color:"#f59e0b",borderRadius:99,padding:"3px 8px",fontSize:10,fontWeight:700}}>✅{openTasks}</div>}
          <button onClick={onLogout} style={{background:"#1e293b",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:10,color:"#64748b"}}>Вийти</button>
        </div>
      </div>
    </div>

    {/* ВИБІР ПРОЄКТУ (якщо кілька) */}
    {myProjects.length>1&&<div style={{background:"#1e293b",padding:"8px 16px",display:"flex",gap:6,overflowX:"auto"}}>
      {myProjects.map(p=><button key={p.id} onClick={()=>setSelProject(p)}
        style={{flexShrink:0,padding:"5px 12px",border:"none",borderRadius:20,cursor:"pointer",fontSize:11,fontWeight:myProject?.id===p.id?700:400,background:myProject?.id===p.id?"#3b82f6":"#334155",color:"#fff"}}>
        {p.name.slice(0,20)}
      </button>)}
    </div>}

    <div style={{padding:"14px 14px 100px"}}>

      {/* МІЙ ОБ'ЄКТ */}
      {myProject?<>
        <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
          <div style={{fontSize:11,color:"#475569",marginBottom:6}}>МІЙ ОБ'ЄКТ</div>
          <div style={{fontSize:16,fontWeight:800,marginBottom:4}}>{myProject.name}</div>
          <div style={{fontSize:12,color:"#94a3b8",marginBottom:10}}>👤 {myProject.client}</div>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <Badge color={stage?.color||"#3b82f6"}>{stage?.emoji} {stage?.label}</Badge>
            <DL date={myProject.deadline}/>
          </div>
          <div style={{fontSize:10,color:"#94a3b8",marginBottom:4}}>Прогрес</div>
          <PBar value={myProject.progress} color={stage?.color||"#3b82f6"} height={8}/>
          <div style={{fontSize:12,fontWeight:700,color:"#fff",marginTop:4,textAlign:"right"}}>{myProject.progress}%</div>
          {myProject.issues&&<div style={{background:"#ef444420",borderRadius:8,padding:"6px 10px",marginTop:8,fontSize:11,color:"#fca5a5"}}>
            ⚠️ {myProject.issues}
          </div>}
        </Card>

        {/* ТАБКИ */}
        <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
          {[
            ["tasks",`✅ Задачі (${openTasks})`],
            ["log","💬 Лог"],
            ["materials","📦 Матеріали"],
            ["knowledge","📚 Інструкції"],
            ["profile","👤 Профіль"],
          ].map(([id,lbl])=><button key={id} onClick={()=>setTab(id)}
            style={{flexShrink:0,padding:"7px 12px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>
            {lbl}
          </button>)}
        </div>

        {/* ── ЗАДАЧІ ── */}
        {tab==="tasks"&&<>
          {myTasks.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:30,fontSize:13}}>
            Задач немає 🎉
          </div>}
          {myTasks.sort((a,b)=>a.done-b.done).map(t=><Card key={t.id} style={{margin:"0 0 8px",opacity:t.done?0.6:1,borderLeft:`3px solid ${prioC[t.priority]||"#94a3b8"}`}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <button onClick={async()=>await tasksH.update(t.id,{done:!t.done,done_at:!t.done?new Date().toISOString():null})}
                style={{width:26,height:26,borderRadius:8,border:`2px solid ${t.done?"#10b981":"#e2e8f0"}`,background:t.done?"#10b981":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,marginTop:2}}>
                {t.done?"✓":""}
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:600,color:"#1e293b",textDecoration:t.done?"line-through":"none"}}>{t.text}</div>
                <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap"}}>
                  {t.priority&&<Badge color={prioC[t.priority]}>{prioL[t.priority]} {t.priority==="critical"?"Критично":t.priority==="high"?"Важливо":t.priority==="medium"?"Середній":"Низький"}</Badge>}
                  {t.category&&t.category!=="Загальне"&&<Badge color="#6366f1">{t.category}</Badge>}
                  {t.due_date&&<DL date={t.due_date}/>}
                </div>
                {t.done&&t.done_at&&<div style={{fontSize:10,color:"#10b981",marginTop:4}}>
                  ✅ Виконано {new Date(t.done_at).toLocaleDateString("uk-UA")}
                </div>}
              </div>
            </div>
          </Card>)}
        </>}

        {/* ── ЛОГ ── */}
        {tab==="log"&&<>
          {/* Додати коментар */}
          <Card style={{background:"#f8fafc",marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:6}}>Додати повідомлення</div>
            <div style={{display:"flex",gap:8}}>
              <Input value={newComment} onChange={setNewComment} placeholder="Питання, проблема, оновлення..." style={{flex:1}}/>
              <Btn onClick={async()=>{
                if(!newComment.trim())return;
                await commentsH.create({project_id:myProject.id,author:member.name,text:newComment,type:"comment"});
                setNewComment("");
              }} small>→</Btn>
            </div>
            <div style={{display:"flex",gap:5,marginTop:6}}>
              {[{t:"update",l:"✅ Оновлення"},{t:"issue",l:"⚠️ Проблема"},{t:"question",l:"❓ Питання"}].map(({t,l})=><button key={t} onClick={async()=>{
                if(!newComment.trim())return;
                await commentsH.create({project_id:myProject.id,author:member.name,text:newComment,type:t});
                setNewComment("");
              }} style={{flex:1,padding:"5px",border:"1px solid #e2e8f0",borderRadius:8,background:"#fff",cursor:"pointer",fontSize:10,color:"#64748b"}}>{l}</button>)}
            </div>
          </Card>

          {myComments.map(c=>{
            const typeC={comment:"#3b82f6",update:"#10b981",issue:"#ef4444",log:"#94a3b8",question:"#8b5cf6"};
            const typeL={comment:"💬",update:"✅",issue:"⚠️",log:"📋",question:"❓"};
            return <div key={c.id} style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:8,borderLeft:`3px solid ${typeC[c.type]||"#94a3b8"}`,boxShadow:"0 1px 6px #00000008"}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontWeight:700,fontSize:12,color:"#1e293b"}}>{typeL[c.type]||"💬"} {c.author}</span>
                <span style={{fontSize:10,color:"#94a3b8"}}>{new Date(c.created_at).toLocaleDateString("uk-UA")}</span>
              </div>
              <div style={{fontSize:13,color:"#334155",lineHeight:1.5}}>{c.text}</div>
            </div>;
          })}
          {myComments.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Повідомлень ще немає</div>}
        </>}

        {/* ── МАТЕРІАЛИ ── */}
        {tab==="materials"&&<>
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Матеріали для вашого об'єкта</div>
          {myMaterials.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Закупівель немає</div>}
          {myMaterials.map(item=>{
            const mat=materials.find(m=>m.id===item.material_id);
            if(!mat)return null;
            const statusC={pending:"#f59e0b",ordered:"#3b82f6",received:"#10b981",paid:"#22c55e"};
            const statusL={pending:"🟡 Очікується",ordered:"🔵 Замовлено",received:"🟢 На об'єкті",paid:"✅ Оплачено"};
            return <Card key={item.id} style={{margin:"0 0 8px",borderLeft:`3px solid ${statusC[item.status]||"#94a3b8"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{mat.name}</div>
                  <div style={{fontSize:11,color:"#94a3b8",marginTop:2}}>{item.qty} {mat.unit}</div>
                  {item.expected_date&&<div style={{marginTop:4}}><DL date={item.expected_date}/></div>}
                  {item.note&&<div style={{fontSize:11,color:"#64748b",marginTop:2}}>{item.note}</div>}
                </div>
                <Badge color={statusC[item.status]||"#94a3b8"}>{statusL[item.status]||item.status}</Badge>
              </div>
            </Card>;
          })}
        </>}

        {/* ── ІНСТРУКЦІЇ ── */}
        {tab==="knowledge"&&<>
          <div style={{fontSize:11,color:"#94a3b8",marginBottom:10}}>Інструкції для вашої спеціалізації</div>
          {myKnowledge.map(k=>{
            const tagC={critical:"#ef4444",important:"#f59e0b",normal:"#10b981"};
            return <Card key={k.id} style={{margin:"0 0 8px",borderLeft:`3px solid ${tagC[k.tag]||"#10b981"}`}}>
              <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>{k.title}</div>
              <div style={{display:"flex",gap:5,marginBottom:6}}>
                <Badge color="#8b5cf6">{k.category}</Badge>
                {k.tag==="critical"&&<Badge color="#ef4444">🔴 Критично</Badge>}
              </div>
              <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,whiteSpace:"pre-wrap"}}>{k.content}</div>
            </Card>;
          })}
          {myKnowledge.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Інструкцій немає</div>}
        </>}

        {/* ── ПРОФІЛЬ ── */}
        {tab==="profile"&&<>
          <Card style={{textAlign:"center",padding:"24px 16px"}}>
            <div style={{fontSize:52,marginBottom:8}}>{SPEC_EMOJI[member.specialization]||"👷"}</div>
            <div style={{fontWeight:800,fontSize:18,marginBottom:4}}>{member.name}</div>
            <Badge color="#10b981">{member.specialization}</Badge>
            <div style={{marginTop:12,fontSize:12,color:"#94a3b8"}}>
              PIN: <span style={{fontWeight:700,color:"#1e293b",letterSpacing:"0.2em"}}>••••</span>
            </div>
          </Card>

          <Card style={{borderLeft:"3px solid #3b82f6"}}>
            <div style={{fontWeight:700,fontSize:13,marginBottom:4}}>🔐 Змінити PIN</div>
            <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>
              Придумайте свій особистий 4-значний код для входу в систему
            </div>
            {!pinModal?<Btn onClick={()=>{setPinModal(true);setNewPin("");setNewPin2("");setPinStep(1);setPinErr("");}} full color="#3b82f6">
              🔑 Змінити PIN
            </Btn>:<>
              <div style={{fontSize:12,fontWeight:600,color:"#1e293b",marginBottom:10,textAlign:"center"}}>
                {pinStep===1?"Введіть новий PIN":"Підтвердіть PIN"}
              </div>
              {/* PIN клавіатура */}
              <div style={{display:"flex",justifyContent:"center",gap:10,marginBottom:12}}>
                {[0,1,2,3].map(i=><div key={i} style={{width:14,height:14,borderRadius:99,background:i<(pinStep===1?newPin:newPin2).length?"#3b82f6":"#e2e8f0",transition:"background .2s"}}/>)}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
                {[1,2,3,4,5,6,7,8,9,"✕",0,"✓"].map((k,i)=><button key={i} onClick={()=>{
                  const cur=pinStep===1?newPin:newPin2;
                  const setCur=pinStep===1?setNewPin:setNewPin2;
                  if(k==="✕") setCur(p=>p.slice(0,-1));
                  else if(k==="✓"){
                    if(cur.length<4){setPinErr("Введіть 4 цифри");return;}
                    if(pinStep===1){setPinStep(2);setPinErr("");}
                    else{
                      if(newPin!==newPin2){setPinErr("PIN не співпадає");setNewPin2("");return;}
                      // Зберігаємо в базу
                      if(teamH&&member.id){
                        teamH.update(member.id,{personal_pin:newPin});
                      }
                      setPinModal(false);
                      alert("✅ PIN змінено! Наступного разу входьте з новим PIN: "+newPin);
                    }
                  }
                  else if(cur.length<4) setCur(p=>p+k);
                }} style={{padding:"12px",background:k==="✓"?"#10b981":k==="✕"?"#ef444420":"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,fontSize:k==="✓"||k==="✕"?16:18,fontWeight:700,color:k==="✓"?"#fff":k==="✕"?"#ef4444":"#1e293b",cursor:"pointer"}}>{k}</button>)}
              </div>
              {pinErr&&<div style={{color:"#ef4444",textAlign:"center",fontSize:12,marginBottom:8}}>{pinErr}</div>}
              <button onClick={()=>{setPinModal(false);setNewPin("");setNewPin2("");setPinStep(1);}} style={{width:"100%",background:"none",border:"1px solid #e2e8f0",borderRadius:10,padding:"8px",cursor:"pointer",fontSize:12,color:"#64748b"}}>Скасувати</button>
            </>}
          </Card>

          <Card>
            <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>📋 Мої спеціалізації</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.8}}>
              Категорії задач які ви бачите:
              {(SPEC_CATEGORIES[member.specialization]||["Загальне"]).map(cat=>(
                <div key={cat} style={{display:"inline-block",background:"#f1f5f9",borderRadius:8,padding:"2px 8px",margin:"2px 3px",fontSize:11,color:"#475569"}}>{cat}</div>
              ))}
            </div>
          </Card>

          <Btn onClick={onLogout} color="#ef4444" outline full>🚪 Вийти</Btn>
        </>}

      </>:<div style={{textAlign:"center",padding:40}}>
        <div style={{fontSize:40,marginBottom:12}}>🏗️</div>
        <div style={{fontWeight:700,fontSize:16,color:"#1e293b",marginBottom:8}}>Об'єктів не знайдено</div>
        <div style={{fontSize:13,color:"#94a3b8"}}>Вас ще не призначено на жоден проєкт.<br/>Зверніться до менеджера.</div>
      </div>}
    </div>

    {/* НИЖНЄ МЕНЮ БРИГАДИ */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#0f172a",borderTop:"1px solid #1e293b",display:"flex"}}>
      {[["tasks","✅","Задачі"],["log","💬","Лог"],["materials","📦","Матеріали"],["knowledge","📚","Інструкції"],["profile","👤","Профіль"]].map(([id,icon,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"9px 2px 12px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
          <span style={{fontSize:16,color:tab===id?"#60a5fa":"#94a3b8"}}>{icon}</span>
          <span style={{fontSize:8,color:tab===id?"#60a5fa":"#94a3b8",fontWeight:tab===id?700:400}}>{lbl}</span>
        </button>
      ))}
    </div>
  </div>;
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
function NotificationCenter({notifsH,onNav}){
  const {data:notifs,update:markRead,reload}=notifsH;
  const [open,setOpen]=useState(false);
  const unread=notifs.filter(n=>!n.read);
  const PRIO_C={critical:"#ef4444",high:"#f59e0b",medium:"#3b82f6",low:"#94a3b8"};

  // Генеруємо нові сповіщення при відкритті
  async function openNotifs(){
    // Викликаємо функцію генерації
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/generate_notifications`,{
      method:"POST",headers:H
    }).catch(()=>{});
    await reload();
    setOpen(true);
  }

  async function markAllRead(){
    for(const n of unread) await markRead(n.id,{read:true});
  }

  if(!open) return <button onClick={openNotifs}
    style={{position:"relative",background:"#1e293b",border:"none",borderRadius:99,width:32,height:32,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>
    🔔
    {unread.length>0&&<div style={{position:"absolute",top:0,right:0,background:"#ef4444",color:"#fff",borderRadius:99,width:16,height:16,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>
      {unread.length>9?"9+":unread.length}
    </div>}
  </button>;

  return <div style={{position:"fixed",inset:0,zIndex:200}} onClick={e=>e.target===e.currentTarget&&setOpen(false)}>
    <div style={{position:"absolute",top:56,right:8,width:Math.min(360,window.innerWidth-16),background:"#fff",borderRadius:16,boxShadow:"0 8px 32px #00000025",overflow:"hidden",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"12px 16px",background:"#0f172a",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{fontWeight:700,color:"#fff",fontSize:14}}>🔔 Сповіщення {unread.length>0&&<span style={{background:"#ef4444",borderRadius:99,padding:"1px 6px",fontSize:10,marginLeft:6}}>{unread.length}</span>}</div>
        <div style={{display:"flex",gap:8}}>
          {unread.length>0&&<button onClick={markAllRead} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:11}}>Всі прочитані</button>}
          <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:18}}>✕</button>
        </div>
      </div>

      <div style={{overflowY:"auto",flex:1}}>
        {notifs.length===0&&<div style={{textAlign:"center",padding:24,color:"#94a3b8",fontSize:13}}>
          ✅ Немає сповіщень
        </div>}

        {notifs.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(n=>{
          const c=PRIO_C[n.priority]||"#94a3b8";
          return <div key={n.id}
            style={{padding:"12px 16px",borderBottom:"1px solid #f1f5f9",background:n.read?"#fff":"#f8fafc",cursor:"pointer",borderLeft:`3px solid ${c}`}}
            onClick={async()=>{
              await markRead(n.id,{read:true});
              if(n.entity_type==="project")onNav("projects");
              else if(n.entity_type==="client")onNav("crm");
              else if(n.entity_type==="task")onNav("projects");
              setOpen(false);
            }}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
              <div style={{fontWeight:n.read?500:700,fontSize:13,flex:1,color:"#1e293b"}}>{n.title}</div>
              {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:c,flexShrink:0,marginLeft:8,marginTop:4}}/>}
            </div>
            {n.body&&<div style={{fontSize:11,color:"#64748b",marginBottom:3}}>{n.body}</div>}
            <div style={{fontSize:10,color:"#94a3b8"}}>{new Date(n.created_at).toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</div>
          </div>;
        })}
      </div>
    </div>
  </div>;
}

// ─── GLOBAL SEARCH ────────────────────────────────────────────────────────────
function GlobalSearch({projects,clients,materials,knowledge,tasks,onNav,onClose}){
  const [q,setQ]=useState("");
  const ref=useRef(null);
  useEffect(()=>{ ref.current?.focus(); },[]);
  const q_=q.toLowerCase();
  const results=q.trim()?[
    ...projects.filter(p=>p.name?.toLowerCase().includes(q_)||p.client?.toLowerCase().includes(q_)).slice(0,4).map(p=>({type:"Проєкт",icon:"🏗",title:p.name,sub:p.client,nav:"projects",color:"#3b82f6"})),
    ...clients.filter(c=>c.name?.toLowerCase().includes(q_)||c.phone?.includes(q_)).slice(0,3).map(c=>({type:"Клієнт",icon:"👥",title:c.name,sub:c.phone,nav:"crm",color:"#6366f1"})),
    ...materials.filter(m=>m.name?.toLowerCase().includes(q_)).slice(0,3).map(m=>({type:"Матеріал",icon:"📦",title:m.name,sub:`₴${fmt(m.opt_price)}/${m.unit}`,nav:"bom",color:"#f59e0b"})),
    ...knowledge.filter(k=>k.title?.toLowerCase().includes(q_)||k.content?.toLowerCase().includes(q_)).slice(0,2).map(k=>({type:"База знань",icon:"📚",title:k.title,sub:k.category,nav:"knowledge",color:"#8b5cf6"})),
    ...tasks.filter(t=>t.text?.toLowerCase().includes(q_)&&!t.done).slice(0,2).map(t=>({type:"Задача",icon:"✅",title:t.text?.slice(0,60),sub:t.assignee,nav:"projects",color:"#10b981"})),
  ]:[];
  return <div>
    <input ref={ref} value={q} onChange={e=>setQ(e.target.value)} placeholder="🔍 Пошук по всій системі..."
      style={{width:"100%",padding:"10px 14px",borderRadius:12,border:`1.5px solid ${q?"#3b82f6":"#e2e8f0"}`,fontSize:14,outline:"none",boxSizing:"border-box",marginBottom:q?12:0}}/>
    {q&&results.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:16,fontSize:13}}>Нічого не знайдено за «{q}»</div>}
    {results.map((r,i)=><div key={i} onClick={()=>{onNav(r.nav);onClose();}}
      style={{display:"flex",alignItems:"center",gap:12,padding:"10px 12px",borderRadius:10,marginBottom:6,background:"#f8fafc",cursor:"pointer",borderLeft:`3px solid ${r.color}`}}>
      <span style={{fontSize:20}}>{r.icon}</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:"#1e293b"}}>{r.title}</div>
        <div style={{fontSize:11,color:"#94a3b8"}}>{r.sub}</div>
      </div>
      <Badge color={r.color}>{r.type}</Badge>
    </div>)}
  </div>;
}

// ─── FINANCIAL FORECAST ───────────────────────────────────────────────────────
function FinancialForecast({projects}){
  const active=projects.filter(p=>!["paid","lead"].includes(p.stage));
  const forecast=active.map(p=>{
    const progress=+p.progress||0;
    let nextPayment=0,nextLabel="",nextDate=null;
    if(progress<40){nextPayment=Math.round(+p.sale_price*0.4);nextLabel="40% — старт";nextDate=p.deadline?new Date(new Date(p.deadline).getTime()-90*86400000):null;}
    else if(progress<70){nextPayment=Math.round(+p.sale_price*0.3);nextLabel="30% — коробка";nextDate=p.deadline?new Date(new Date(p.deadline).getTime()-30*86400000):null;}
    else if(progress<100){nextPayment=Math.round(+p.sale_price*0.2);nextLabel="20% — здача";nextDate=p.deadline?new Date(p.deadline):null;}
    return {project:p,nextPayment,nextLabel,nextDate};
  }).filter(f=>f.nextPayment>0);
  const total3m=forecast.filter(f=>f.nextDate&&f.nextDate<=new Date(Date.now()+90*86400000)).reduce((s,f)=>s+f.nextPayment,0);
  const totalExpected=forecast.reduce((s,f)=>s+f.nextPayment,0);
  if(!forecast.length)return null;
  return <Card style={{borderLeft:"3px solid #8b5cf6",marginBottom:14}}>
    <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>💎 Очікувані платежі</div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
      <div style={{background:"#f5f3ff",borderRadius:10,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:"#94a3b8"}}>Найближчі 3 місяці</div>
        <div style={{fontSize:16,fontWeight:800,color:"#8b5cf6"}}>₴{fmt(total3m)}</div>
      </div>
      <div style={{background:"#f8fafc",borderRadius:10,padding:"8px 10px"}}>
        <div style={{fontSize:9,color:"#94a3b8"}}>Всього до отримання</div>
        <div style={{fontSize:16,fontWeight:800,color:"#3b82f6"}}>₴{fmt(totalExpected)}</div>
      </div>
    </div>
    {forecast.map((f,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f1f5f9"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:12,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:160}}>{f.project.name}</div>
        <div style={{fontSize:10,color:"#94a3b8"}}>{f.nextLabel}{f.nextDate&&` · ${f.nextDate.toLocaleDateString("uk-UA",{day:"2-digit",month:"2-digit"})}`}</div>
      </div>
      <div style={{fontWeight:700,fontSize:13,color:"#8b5cf6"}}>₴{fmt(f.nextPayment)}</div>
    </div>)}
  </Card>;
}

function Dashboard({projects,workers,operations,procurement,onNav,tasks,projectsH,commentsH,tasksH,user,clients,materials,knowledge}){
  const tSale =projects.reduce((s,p)=>s+ +p.sale_price,0);
  const tSpent=projects.reduce((s,p)=>s+ +p.spent,0);
  const tAdv  =projects.reduce((s,p)=>s+ +p.advance,0);
  const margin=tSale-tSpent;
  const mPct  =tSale>0?Math.round(margin/tSale*100):0;
  const overdue=projects.filter(p=>dLeft(p.deadline)<0&&p.stage!=="paid");
  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const pendingProc=procurement.filter(p=>p.status==="pending").length;
  const openTasks=(tasks||[]).filter(t=>!t.done).length;
  const critTasks=(tasks||[]).filter(t=>!t.done&&t.priority==="critical").length;

  const [searchOpen,setSearchOpen]=useState(false);
  const [quickComment,setQuickComment]=useState({});
  const [expanded,setExpanded]=useState(null);

  const kpis=[
    {l:"Активних проєктів", v:projects.filter(p=>p.stage!=="paid").length, c:"#3b82f6", i:"🏗️", nav:"projects"},
    {l:`Маржа (${mPct}%)`,  v:"₴"+fmt(margin), c:mPct>=25?"#10b981":mPct>=15?"#f59e0b":"#ef4444", i:"📈", nav:"analytics"},
    {l:"Праця (1 будинок)", v:"₴"+fmt(laborCost), c:"#06b6d4", i:"👷", nav:"costing"},
    {l:"Закупити позицій",  v:pendingProc, c:pendingProc>0?"#f59e0b":"#10b981", i:"📦", nav:"procurement"},
    {l:"Відкриті задачі",   v:openTasks, c:critTasks>0?"#ef4444":openTasks>0?"#f59e0b":"#10b981", i:"✅", nav:"projects"},
    {l:"Аванси в касі",     v:"₴"+fmt(tAdv), c:"#8b5cf6", i:"💳", nav:"analytics"},
  ];

  const near=[...projects].filter(p=>p.stage!=="paid"&&p.deadline).sort((a,b)=>new Date(a.deadline)-new Date(b.deadline)).slice(0,5);

  return <div>
    {/* Пошуковий рядок */}
    <div style={{marginBottom:12}}>
      {searchOpen
        ?<div style={{background:"#fff",borderRadius:14,padding:"12px 14px",boxShadow:"0 4px 20px #00000015"}}>
          <GlobalSearch projects={projects} clients={clients||[]} materials={materials||[]} knowledge={knowledge||[]} tasks={tasks||[]} onNav={onNav} onClose={()=>setSearchOpen(false)}/>
          <button onClick={()=>setSearchOpen(false)} style={{width:"100%",background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:12,marginTop:8}}>Закрити</button>
        </div>
        :<button onClick={()=>setSearchOpen(true)} style={{width:"100%",padding:"10px 14px",borderRadius:12,border:"1.5px solid #e2e8f0",background:"#fff",cursor:"pointer",textAlign:"left",fontSize:13,color:"#94a3b8",display:"flex",alignItems:"center",gap:8}}>
          <span>🔍</span><span>Пошук по системі...</span>
        </button>}
    </div>

    {overdue.length>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626",fontWeight:600}}>
      🚨 {overdue.length} прострочено! <span onClick={()=>onNav("projects")} style={{textDecoration:"underline",cursor:"pointer"}}>Переглянути →</span>
    </div>}

    {/* KPI картки */}
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
      {kpis.map((k,i)=><Card key={i} style={{margin:0,padding:"12px 14px",cursor:"pointer",borderBottom:`3px solid ${k.c}`}} onClick={()=>onNav(k.nav)}>
        <div style={{fontSize:20,marginBottom:4}}>{k.i}</div>
        <div style={{fontSize:15,fontWeight:800,color:k.c}}>{k.v}</div>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{k.l}</div>
        <div style={{fontSize:9,color:k.c,marginTop:2,fontWeight:600}}>→ перейти</div>
      </Card>)}
    </div>

    {/* Фінансовий прогноз */}
    <FinancialForecast projects={projects}/>

    {/* Активні проєкти з quick actions */}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
      <div style={{fontWeight:700,fontSize:11,color:"#64748b",letterSpacing:"0.08em"}}>АКТИВНІ ПРОЄКТИ</div>
    </div>
    {near.map(p=>{
      const s=STAGES.find(x=>x.id===p.stage)||STAGES[0];
      const m=+p.sale_price- +p.spent;
      const mPct_=+p.sale_price>0?Math.round(m/+p.sale_price*100):0;
      const pTasks=(tasks||[]).filter(t=>t.project_id===p.id&&!t.done);
      const isExpanded=expanded===p.id;

      return <Card key={p.id} style={{margin:"0 0 8px"}}>
        {/* Заголовок — клік відкриває quick actions */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6,cursor:"pointer"}} onClick={()=>setExpanded(isExpanded?null:p.id)}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{p.name}</div>
            <div style={{fontSize:11,color:"#64748b"}}>👤 {p.client}</div>
          </div>
          <div style={{display:"flex",gap:5,alignItems:"center",flexShrink:0,marginLeft:8}}>
            <Badge color={s.color}>{s.emoji} {s.label}</Badge>
            <span style={{fontSize:12,color:"#94a3b8"}}>{isExpanded?"▲":"▼"}</span>
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            <DL date={p.deadline}/>
            <Badge color={mPct_>=25?"#10b981":mPct_>=15?"#f59e0b":"#ef4444"}>Маржа {mPct_}%</Badge>
            {pTasks.length>0&&<Badge color="#f59e0b">✅ {pTasks.length}</Badge>}
          </div>
          <span style={{fontSize:11,fontWeight:700,color:s.color}}>{p.progress}%</span>
        </div>
        <PBar value={p.progress} color={s.color}/>

        {p.issues&&<div style={{fontSize:10,color:"#b45309",background:"#fef3c7",borderRadius:6,padding:"3px 8px",marginTop:6}}>⚠️ {p.issues}</div>}

        {/* QUICK ACTIONS — розгортається */}
        {isExpanded&&<div style={{marginTop:10,borderTop:"1px solid #f1f5f9",paddingTop:10}}>

          {/* Зміна етапу */}
          <div style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>ЗМІНИТИ ЕТАП</div>
          <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
            {STAGES.map(st=><button key={st.id} onClick={()=>projectsH.update(p.id,{stage:st.id})}
              style={{fontSize:10,padding:"4px 8px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:p.stage===st.id?700:400,background:p.stage===st.id?st.color:"#f1f5f9",color:p.stage===st.id?"#fff":"#64748b"}}>
              {st.emoji} {st.label}
            </button>)}
          </div>

          {/* Прогрес */}
          <div style={{fontSize:10,color:"#94a3b8",marginBottom:4,fontWeight:600}}>ПРОГРЕС: {p.progress}%</div>
          <input type="range" min="0" max="100" value={p.progress}
            onChange={e=>projectsH.update(p.id,{progress:+e.target.value})}
            style={{width:"100%",accentColor:s.color,marginBottom:10}}/>

          {/* Задачі */}
          {pTasks.length>0&&<>
            <div style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>ВІДКРИТІ ЗАДАЧІ</div>
            {pTasks.slice(0,3).map(t=><div key={t.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 0",borderBottom:"1px solid #f9fafb"}}>
              <button onClick={()=>tasksH.update(t.id,{done:true,done_at:new Date().toISOString()})}
                style={{width:20,height:20,borderRadius:6,border:"2px solid #e2e8f0",background:"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>
              </button>
              <span style={{fontSize:11,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.text}</span>
              <Badge color={t.priority==="critical"?"#ef4444":t.priority==="high"?"#f59e0b":"#3b82f6"}>{t.priority==="critical"?"🔴":t.priority==="high"?"🟡":"🔵"}</Badge>
            </div>)}
            {pTasks.length>3&&<div style={{fontSize:10,color:"#3b82f6",marginTop:4}}>+ ще {pTasks.length-3} задач</div>}
            <div style={{marginBottom:8}}/>
          </>}

          {/* Швидкий коментар */}
          <div style={{fontSize:10,color:"#94a3b8",marginBottom:5,fontWeight:600}}>ШВИДКИЙ КОМЕНТАР</div>
          <div style={{display:"flex",gap:6}}>
            <Input value={quickComment[p.id]||""} onChange={v=>setQuickComment(prev=>({...prev,[p.id]:v}))}
              placeholder="Оновлення, проблема..." style={{flex:1,fontSize:11}}/>
            <Btn small onClick={async()=>{
              const text=quickComment[p.id]?.trim();
              if(!text)return;
              await commentsH.create({project_id:p.id,author:user?.name||"Менеджер",text,type:"update"});
              setQuickComment(prev=>({...prev,[p.id]:""}));
            }}>→</Btn>
          </div>

          {/* Відкрити повністю */}
          <Btn onClick={()=>onNav("projects")} full outline color="#3b82f6" small style={{marginTop:8}}>
            Відкрити проєкт повністю →
          </Btn>
        </div>}
      </Card>;
    })}

    {projects.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>
      Немає проєктів. <span onClick={()=>onNav("projects")} style={{color:"#3b82f6",cursor:"pointer"}}>Додати →</span>
    </div>}
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

// ─── CONFIGURATOR ─────────────────────────────────────────────────────────────
function Configurator({sizesH,materialsH,workersH,operationsH,productsH}){
  const {data:sizes,create:createSize,update:updateSize}=sizesH;
  const materials=materialsH.data;
  const workers=workersH.data;
  const operations=operationsH.data;

  // Конфігурація
  const [cfg,setCfg]=useState({
    // Розміри
    sizeId:"",
    customW:0, customL:0,        // для індивідуального
    modules:1,                    // кількість модулів
    hasTerrace:false,
    terraceW:2.5, terraceL:6,
    heightExt:3.0,                // висота зовні
    heightInt:2.5,                // чистова всередині
    // Конструкція
    floorThick:200,
    wallExtThick:150,
    wallIntThick:100,
    roofThick:200,
    // Фасад
    facade:"planken",             // planken, termo, imitacia, siding
    facadeColor:"anthracite",     // anthracite, brown, yellow, custom
    // Комплектація
    kit:"turnkey",                // rough=під ремонт, turnkey=під ключ, premium=преміум
    // Опції
    hasElectric:true,
    hasWater:true,
    hasSewage:true,
    hasHeatedFloor:false,
    hasKitchen:false,
    hasAC:false,                  // закладна під кондиціонер
    hasWarmPorch:false,
    // Оплата бригади
    labourScheme:"fixed",         // fixed=фіксована, perSqm=по м²
    labourFixed:150000,
    // Маржа
    margin:30,
  });

  const set=k=>v=>setCfg(p=>({...p,[k]:v}));

  // Розрахунок площ
  const selSize=sizes.find(s=>s.id===cfg.sizeId);
  const W=selSize?.name==="Індивідуальний"?+cfg.customW:(selSize?+selSize.width:0);
  const L=selSize?.name==="Індивідуальний"?+cfg.customL:(selSize?+selSize.length:0);
  const floorArea=W*L*cfg.modules;
  const terraceArea=cfg.hasTerrace?+cfg.terraceW * +cfg.terraceL:0;
  const extWallArea=(2*(W+L*cfg.modules))*2.55;
  const roofArea=W*L*cfg.modules;

  // Розрахунок вартості матеріалів
  function calcMaterials(){
    let cost=0;
    // Базальтова вата
    const vataFloor=floorArea*2*250;      // 200мм = 2 шари по 100мм × 250грн
    const vataWalls=extWallArea*1.5*250;  // 150мм
    const vataRoof=roofArea*2*250;        // 200мм
    cost+=vataFloor+vataWalls+vataRoof;
    // Паробар'єр
    const paraArea=floorArea+extWallArea+roofArea;
    cost+=Math.ceil(paraArea/75)*1500;
    // Мембрана
    cost+=Math.ceil((extWallArea+roofArea*1.1)/75)*1200;
    // ПВХ покрівля
    cost+=roofArea*1.15*350;
    // Дошка каркас (орієнтовно 0.06м³ на м² підлоги)
    cost+=floorArea*0.06*15000;
    // OSB підлога
    cost+=Math.ceil(floorArea/3.125)*850;
    // OSB покрівля
    cost+=Math.ceil(roofArea/3.125)*520;
    // Сітка від гризунів
    cost+=floorArea*1.1*85;
    // Фасад
    const facadePrices={planken:550,termo:2000,imitacia:420,siding:380};
    cost+=extWallArea*1.15*(facadePrices[cfg.facade]||550)+5000;
    // Скотчі
    cost+=8*280+6*185+8*95+8*145;
    // Вікна і двері (орієнтовно 2 вікна + 1 двері)
    const windowArea=cfg.modules*3.5; // ~3.5м² вікон на модуль
    cost+=windowArea*4500+7000; // вікна + вхідні двері
    // Міжкімнатні двері
    const intDoors=cfg.modules>1?2:1;
    cost+=intDoors*11000;
    // Комунікації
    if(cfg.hasElectric) cost+=20000;
    if(cfg.hasWater)    cost+=20000;
    if(cfg.hasSewage)   cost+=20000;
    // Тепла підлога
    if(cfg.hasHeatedFloor) cost+=floorArea*650;
    // Кухня
    if(cfg.hasKitchen) cost+=35000;
    // Внутрішнє оздоблення (базово ламінат + вагонка)
    cost+=floorArea*450+floorArea*0.5+extWallArea*0.8*185;
    return Math.round(cost);
  }

  // Розрахунок праці
  function calcLabour(){
    if(cfg.labourScheme==="fixed") return +cfg.labourFixed;
    // По м²
    const labour=
      floorArea*900+        // підлога
      extWallArea*700+      // стіни
      roofArea*900+         // покрівля
      (cfg.hasElectric?floorArea*300:0)+
      (cfg.hasWater?floorArea*200:0)+
      extWallArea*800;      // фасад
    return Math.round(labour);
  }

  const matCost=W>0&&L>0?calcMaterials():0;
  const labCost=W>0&&L>0?calcLabour():0;
  const overhead=Math.round((matCost+labCost)*0.06);
  const totalCost=matCost+labCost+overhead;
  const salePrice=Math.round(totalCost*(1+cfg.margin/100));
  const marginAmt=salePrice-totalCost;

  const FACADES=[
    {v:"planken",l:"🪵 Планкен сосна (550 грн/м²)"},
    {v:"termo",  l:"🌑 Термодерево (2000 грн/м²)"},
    {v:"imitacia",l:"📋 Імітація бруса"},
    {v:"siding", l:"🔲 Сайдинг"},
  ];
  const KITS=[
    {v:"rough",   l:"🔨 Під ремонт (без оздоблення)"},
    {v:"turnkey", l:"🏠 Під ключ (стандарт)"},
    {v:"premium", l:"⭐ Преміум"},
  ];

  const [addSizeModal,setAddSizeModal]=useState(false);
  const [newSize,setNewSize]=useState({name:"",width:0,length:0});
  const [saveModal,setSaveModal]=useState(false);
  const [saveName,setSaveName]=useState("");

  const popularSizes=sizes.filter(s=>s.is_popular&&s.status==="active");
  const allSizes=sizes.filter(s=>s.status==="active");

  return <div>
    {/* КРОК 1 — РОЗМІР */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>📐 Розмір модуля</div>

      {/* Популярні */}
      <div style={{fontSize:10,color:"#94a3b8",marginBottom:6}}>ПОПУЛЯРНІ</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:10}}>
        {popularSizes.map(s=><button key={s.id} onClick={()=>setCfg(p=>({...p,sizeId:s.id}))}
          style={{padding:"6px 12px",borderRadius:10,border:`2px solid ${cfg.sizeId===s.id?"#3b82f6":"#e2e8f0"}`,background:cfg.sizeId===s.id?"#eff6ff":"#fff",cursor:"pointer",fontSize:12,fontWeight:cfg.sizeId===s.id?700:400,color:cfg.sizeId===s.id?"#3b82f6":"#475569"}}>
          {s.name}
        </button>)}
      </div>

      {/* Всі розміри */}
      <Lbl>Всі розміри</Lbl>
      <Sel value={cfg.sizeId} onChange={set("sizeId")} options={[{v:"",l:"— Оберіть розмір —"},...allSizes.map(s=>({v:s.id,l:s.name+(s.is_popular?" ⭐":"")}))]}/>

      {/* Індивідуальний */}
      {selSize?.name==="Індивідуальний"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
        <div><Lbl>Ширина (м)</Lbl><Input type="number" value={cfg.customW} onChange={set("customW")}/></div>
        <div><Lbl>Довжина (м)</Lbl><Input type="number" value={cfg.customL} onChange={set("customL")}/></div>
      </div>}

      {/* Кількість модулів */}
      <Lbl>Кількість модулів</Lbl>
      <div style={{display:"flex",gap:6}}>
        {[1,2,3,4].map(n=><button key={n} onClick={()=>set("modules")(n)}
          style={{flex:1,padding:"8px",border:`2px solid ${cfg.modules===n?"#3b82f6":"#e2e8f0"}`,borderRadius:10,background:cfg.modules===n?"#eff6ff":"#fff",cursor:"pointer",fontWeight:cfg.modules===n?700:400,color:cfg.modules===n?"#3b82f6":"#475569",fontSize:13}}>
          {n}
        </button>)}
      </div>

      {W>0&&L>0&&<div style={{background:"#f0f9ff",borderRadius:10,padding:"8px 12px",marginTop:10,fontSize:12,color:"#0369a1",fontWeight:600}}>
        📐 {W}×{L*cfg.modules}м = <strong>{(W*L*cfg.modules).toFixed(1)}м²</strong> підлоги
        {cfg.hasTerrace&&<span> + {cfg.terraceW}×{cfg.terraceL}м тераса = <strong>{terraceArea}м²</strong></span>}
      </div>}

      {/* Тераса */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginTop:10}}>
        <button onClick={()=>set("hasTerrace")(!cfg.hasTerrace)}
          style={{width:24,height:24,borderRadius:6,border:`2px solid ${cfg.hasTerrace?"#10b981":"#e2e8f0"}`,background:cfg.hasTerrace?"#10b981":"transparent",cursor:"pointer",color:"#fff",fontSize:14}}>
          {cfg.hasTerrace?"✓":""}
        </button>
        <span style={{fontSize:13,fontWeight:600}}>Тераса</span>
      </div>
      {cfg.hasTerrace&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
        <div><Lbl>Ширина тераси (м)</Lbl><Input type="number" value={cfg.terraceW} onChange={set("terraceW")}/></div>
        <div><Lbl>Довжина тераси (м)</Lbl><Input type="number" value={cfg.terraceL} onChange={set("terraceL")}/></div>
      </div>}

      {/* Додати новий розмір */}
      <button onClick={()=>setAddSizeModal(true)} style={{marginTop:10,background:"none",border:"1px dashed #94a3b8",borderRadius:10,padding:"6px 14px",cursor:"pointer",fontSize:11,color:"#64748b",width:"100%"}}>
        + Додати новий розмір до списку
      </button>
    </Card>

    {/* КРОК 2 — ВИСОТИ */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>📏 Висоти</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><Lbl>Висота зовні (м)</Lbl><Input type="number" value={cfg.heightExt} onChange={set("heightExt")} placeholder="3.0"/></div>
        <div><Lbl>Чистова всередині (м)</Lbl><Input type="number" value={cfg.heightInt} onChange={set("heightInt")} placeholder="2.5"/></div>
      </div>
      <div style={{fontSize:10,color:"#94a3b8",marginTop:6}}>За замовчуванням: зовні 3.0м, всередині 2.5м</div>
    </Card>

    {/* КРОК 3 — ТОВЩИНИ КОНСТРУКЦІЙ */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>🏗️ Товщина (з утепленням, мм)</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {[
          {k:"floorThick",  l:"Підлога",         def:200},
          {k:"wallExtThick",l:"Стіни зовн.",      def:150},
          {k:"wallIntThick",l:"Стіни внутр.",     def:100},
          {k:"roofThick",   l:"Покрівля",         def:200},
        ].map(({k,l,def})=><div key={k}>
          <Lbl>{l} (мм)</Lbl>
          <Sel value={cfg[k]} onChange={v=>setCfg(p=>({...p,[k]:+v}))} options={[100,150,200,250,300].map(v=>({v,l:`${v}мм${v===def?" (стандарт)":""}`}))}/>
        </div>)}
      </div>
    </Card>

    {/* КРОК 4 — ФАСАД */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>🎨 Фасад</div>
      {FACADES.map(f=><button key={f.v} onClick={()=>set("facade")(f.v)}
        style={{display:"flex",width:"100%",padding:"8px 12px",marginBottom:6,border:`2px solid ${cfg.facade===f.v?"#3b82f6":"#e2e8f0"}`,borderRadius:10,background:cfg.facade===f.v?"#eff6ff":"#fff",cursor:"pointer",textAlign:"left",fontSize:12,fontWeight:cfg.facade===f.v?700:400,color:cfg.facade===f.v?"#3b82f6":"#475569"}}>
        {f.l}
      </button>)}
      {cfg.facade==="planken"&&<>
        <Lbl>Колір</Lbl>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[{v:"anthracite",l:"Антрацит",c:"#1e293b"},{v:"brown",l:"Темно-коричневий",c:"#7c3f14"},{v:"yellow",l:"Світло-жовтий",c:"#d4a017"},{v:"custom",l:"Інший",c:"#94a3b8"}].map(col=>(
            <button key={col.v} onClick={()=>set("facadeColor")(col.v)}
              style={{padding:"5px 10px",borderRadius:10,border:`2px solid ${cfg.facadeColor===col.v?"#3b82f6":"#e2e8f0"}`,background:col.c,cursor:"pointer",fontSize:11,color:"#fff",fontWeight:cfg.facadeColor===col.v?700:400}}>
              {col.l}
            </button>
          ))}
        </div>
      </>}
    </Card>

    {/* КРОК 5 — КОМПЛЕКТАЦІЯ */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>📦 Комплектація</div>
      {KITS.map(k=><button key={k.v} onClick={()=>set("kit")(k.v)}
        style={{display:"flex",width:"100%",padding:"8px 12px",marginBottom:6,border:`2px solid ${cfg.kit===k.v?"#6366f1":"#e2e8f0"}`,borderRadius:10,background:cfg.kit===k.v?"#eef2ff":"#fff",cursor:"pointer",textAlign:"left",fontSize:12,fontWeight:cfg.kit===k.v?700:400,color:cfg.kit===k.v?"#6366f1":"#475569"}}>
        {k.l}
      </button>)}

      {/* Опції */}
      <Lbl>Опції</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {k:"hasElectric",   l:"⚡ Електрика"},
          {k:"hasWater",      l:"🚿 Водопровід"},
          {k:"hasSewage",     l:"🔧 Каналізація"},
          {k:"hasHeatedFloor",l:"🌡️ Тепла підлога"},
          {k:"hasKitchen",    l:"🍳 Кухня"},
          {k:"hasAC",         l:"❄️ Закладна кондиц."},
        ].map(({k,l})=><button key={k} onClick={()=>setCfg(p=>({...p,[k]:!p[k]}))}
          style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",border:`2px solid ${cfg[k]?"#10b981":"#e2e8f0"}`,borderRadius:10,background:cfg[k]?"#f0fdf4":"#fff",cursor:"pointer",fontSize:11,fontWeight:cfg[k]?700:400,color:cfg[k]?"#10b981":"#475569"}}>
          <div style={{width:16,height:16,borderRadius:4,background:cfg[k]?"#10b981":"transparent",border:`2px solid ${cfg[k]?"#10b981":"#94a3b8"}`,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:10,flexShrink:0}}>
            {cfg[k]?"✓":""}
          </div>
          {l}
        </button>)}
      </div>
    </Card>

    {/* КРОК 6 — ОПЛАТА БРИГАДИ */}
    <Card>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>👷 Оплата бригади</div>
      <div style={{display:"flex",gap:6,marginBottom:10}}>
        {[{v:"fixed",l:"Фіксована"},{v:"perSqm",l:"По м²"}].map(s=><button key={s.v} onClick={()=>set("labourScheme")(s.v)}
          style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:12,background:cfg.labourScheme===s.v?"#1e293b":"#e2e8f0",color:cfg.labourScheme===s.v?"#fff":"#64748b"}}>{s.l}</button>)}
      </div>
      {cfg.labourScheme==="fixed"&&<>
        <Lbl>Сума (₴)</Lbl>
        <Sel value={cfg.labourFixed} onChange={v=>set("labourFixed")(+v)} options={[70000,100000,107500,125000,150000,175000].map(v=>({v,l:`₴${fmt(v)}${v===150000?" (поточна)":""}`}))}/>
      </>}
      {cfg.labourScheme==="perSqm"&&W>0&&L>0&&<div style={{background:"#f8fafc",borderRadius:10,padding:"10px 12px",fontSize:12,color:"#475569"}}>
        Підлога {floorArea}м²×900 + Стіни {extWallArea.toFixed(0)}м²×700 + Покрівля {roofArea}м²×900 = <strong style={{color:"#1e293b"}}>₴{fmt(labCost)}</strong>
      </div>}
    </Card>

    {/* МАРЖА */}
    <Card>
      <Lbl>Маржа: <strong style={{color:"#10b981"}}>{cfg.margin}%</strong></Lbl>
      <input type="range" min="15" max="60" value={cfg.margin} onChange={e=>set("margin")(+e.target.value)} style={{width:"100%",accentColor:"#10b981"}}/>
    </Card>

    {/* РЕЗУЛЬТАТ */}
    {W>0&&L>0&&<>
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:12}}>РЕЗУЛЬТАТ КОНФІГУРАТОРА · {W}×{L*cfg.modules}м</div>
        {[
          {l:"🪵 Матеріали (орієнт.)",  v:matCost,    c:"#f59e0b"},
          {l:"👷 Праця бригади",         v:labCost,    c:"#06b6d4"},
          {l:"📋 Накладні 6%",           v:overhead,   c:"#8b5cf6"},
          {l:"СОБІВАРТІСТЬ",              v:totalCost,  c:"#e2e8f0", bold:true},
          {l:`ЦІНА (${cfg.margin}% маржа)`,v:salePrice, c:"#10b981", big:true},
          {l:"МАРЖА ₴",                  v:marginAmt,  c:"#22c55e", bold:true},
        ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<5?"1px solid #ffffff10":"none"}}>
          <span style={{fontSize:x.bold||x.big?12:11,color:x.bold||x.big?"#cbd5e1":"#94a3b8"}}>{x.l}</span>
          <span style={{fontSize:x.big?20:x.bold?15:13,fontWeight:x.big?900:x.bold?700:600,color:x.c}}>₴{fmt(x.v)}</span>
        </div>)}
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn onClick={()=>setSaveModal(true)} color="#10b981" full>💾 Зберегти як продукт</Btn>
        <Btn onClick={()=>{
          const win=window.open("","_blank");
win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>КП</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b}h1{font-size:20px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8fafc;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:12px}td{padding:8px;border-bottom:1px solid #f9fafb;font-size:13px}.price{font-weight:900;color:#10b981;font-size:22px}</style></head><body> <h1>🏗️ МОДУЛЕР ПРО — КП</h1> <p>${new Date().toLocaleDateString("uk-UA")} · ${W}×${L*cfg.modules}м (${(W*L*cfg.modules).toFixed(1)}м²)${cfg.hasTerrace?` + тераса ${cfg.terraceW}×${cfg.terraceL}м`:""}</p> <table><tr><th>Складова</th><th>Сума</th></tr> <tr><td>Матеріали</td><td>₴${fmt(matCost)}</td></tr> <tr><td>Праця бригади</td><td>₴${fmt(labCost)}</td></tr> <tr><td>Накладні</td><td>₴${fmt(overhead)}</td></tr> <tr><td><b>Собівартість</b></td><td><b>₴${fmt(totalCost)}</b></td></tr> <tr><td colspan="2" style="text-align:center;padding:16px"><span class="price">Ціна: ₴${fmt(salePrice)}</span></td></tr></table> <p>Фасад: ${FACADES.find(f=>f.v===cfg.facade)?.l||cfg.facade}</p> <p>Комплектація: ${KITS.find(k=>k.v===cfg.kit)?.l||cfg.kit}</p> <h3>Схема оплат</h3><p>10% бронювання · 40% старт · 30% коробка · 20% здача</p> </body></html>`);
          win.document.close(); win.print();
        }} color="#6366f1" full>📄 КП (PDF)</Btn>
      </div>
    </>}

    {/* Модал — додати розмір */}
    {addSizeModal&&<Modal title="Новий розмір модуля" onClose={()=>setAddSizeModal(false)}>
      <Lbl>Назва</Lbl><Input value={newSize.name} onChange={v=>setNewSize(p=>({...p,name:v}))} placeholder="3.5×7"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><Lbl>Ширина (м)</Lbl><Input type="number" value={newSize.width} onChange={v=>setNewSize(p=>({...p,width:+v}))}/></div>
        <div><Lbl>Довжина (м)</Lbl><Input type="number" value={newSize.length} onChange={v=>setNewSize(p=>({...p,length:+v}))}/></div>
      </div>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setAddSizeModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          await createSize({name:newSize.name,width:newSize.width,length:newSize.length,is_popular:false,status:"active",sort_order:sizes.length+1});
          setAddSizeModal(false);setNewSize({name:"",width:0,length:0});
        }} color="#3b82f6" style={{flex:2}}>💾 Додати</Btn>
      </div>
    </Modal>}

    {/* Модал — зберегти як продукт */}
    {saveModal&&<Modal title="Зберегти як продукт" onClose={()=>setSaveModal(false)}>
      <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#166534"}}>
        {W}×{L*cfg.modules}м · Ціна <strong>₴{fmt(salePrice)}</strong> · Маржа <strong>{cfg.margin}%</strong>
      </div>
      <Lbl>Назва продукту</Lbl>
      <Input value={saveName} onChange={setSaveName} placeholder={`Каркасний ${W}×${L*cfg.modules} ${FACADES.find(f=>f.v===cfg.facade)?.l?.split(" ")[1]||""}`}/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setSaveModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          if(!saveName.trim())return;
          await productsH.create({
            name:saveName,
            description:`${W}×${L*cfg.modules}м (${(W*L*cfg.modules).toFixed(1)}м²)${cfg.hasTerrace?` + тераса`:""} · ${FACADES.find(f=>f.v===cfg.facade)?.l} · ${KITS.find(k=>k.v===cfg.kit)?.l}`,
            model:`${W}x${L*cfg.modules}`,
            status:"draft",
            sale_price:salePrice,
            cost_price:totalCost,
            margin_pct:cfg.margin,
            notes:JSON.stringify({cfg,areas:{floorArea,extWallArea,roofArea,terraceArea}}),
            version:"1.0",
            valid_date:today(),
          });
          setSaveModal(false);setSaveName("");
        }} color="#10b981" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── COSTING ──────────────────────────────────────────────────────────────────
function Costing({workersH,operationsH,materialsH,bomH,productsH,overheadH,suppliersH,pricesH,projectsH}){
  const workers   =workersH.data;
  const operations=operationsH.data;
  const materials =materialsH.data;
  const allBom    =bomH.data;
  const overhead  =overheadH?.data||[];
  const suppliers =suppliersH?.data||[];
  const prices    =pricesH?.data||[];

  const [tab,setTab]=useState("summary");
  const [margin,setMargin]=useState(30);
  const [qty,setQty]=useState(1);
  const [model,setModel]=useState("6x6.5");    // ← дефолт тепер 6x6.5
  const [labourScheme,setLabourScheme]=useState("fixed");
  const [labourFixed,setLabourFixed]=useState(150000);
  const [expandPhase,setExpandPhase]=useState(null);
  const [opModal,setOpModal]=useState(null);
  const [opForm,setOpForm]=useState(null);
  const [saveModal,setSaveModal]=useState(false);
  const [saveName,setSaveName]=useState("");

  // ПУНКТ 1 — BOM по вибраній моделі
  const bom=allBom.filter(b=>b.model===model);
  const availableModels=[...new Set(allBom.map(b=>b.model))];

  // ПУНКТ 2 — Точний розрахунок матеріалів
  const matOpt   =bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);
  const matRetail=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.retail_price*i.qty:0);},0);
  const saving   =matRetail-matOpt;

  // ПУНКТ 3 — Два варіанти оплати бригади
  const laborCostOps=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  // По м² (для 6×6.5м = 39м²)
  const floorArea=model==="6x6.5"?39:model==="3x6"?18:39;
  const extWallArea=model==="6x6.5"?56:model==="3x6"?30:56;
  const roofArea=floorArea;
  const laborCostSqm=Math.round(floorArea*900+extWallArea*700+roofArea*900);
  const laborCost=labourScheme==="fixed"?labourFixed:labourScheme==="perSqm"?laborCostSqm:laborCostOps;

  // ПУНКТ 4 — Офісні витрати
  const curMonth=new Date().toISOString().slice(0,7);
  const monthOverhead=overhead.filter(o=>o.month?.startsWith(curMonth));
  const totalOverhead=monthOverhead.reduce((s,o)=>s+ +o.amount,0);
  const activeProjects=(projectsH?.data||[]).filter(p=>!["paid","lead"].includes(p.stage));
  const overheadPerUnit=activeProjects.length>0?Math.round(totalOverhead/activeProjects.length):0;

  const overhead6=Math.round((laborCost+matOpt)*0.06);
  const cost     =laborCost+matOpt+overhead6;
  const costWithOverhead=cost+overheadPerUnit;
  const price    =Math.round(cost*(1+margin/100));
  const priceWithOverhead=Math.round(costWithOverhead*(1+margin/100));
  const totalHours=operations.reduce((s,o)=>s+o.hours*o.qty,0);
  const phases   =[...new Set(operations.map(o=>o.phase))];

  // ПУНКТ 5 — Найкращий постачальник по кожному матеріалу BOM
  function getBestSupplier(matId){
    const matPrices=prices.filter(p=>p.material_id===matId).sort((a,b)=>+a.price- +b.price);
    if(!matPrices.length) return null;
    const best=matPrices[0];
    const sup=suppliers.find(s=>s.id===best.supplier_id);
    return {price:+best.price, supplier:sup?.name||"—", savings:matPrices.length>1?+matPrices[matPrices.length-1].price- +best.price:0};
  }

  if(operationsH.loading||materialsH.loading)return <Spin/>;

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["summary","Підсумок"],["compare","Порівняння"],["phases","Фази"],["materials","Матеріали"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 12px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── ПІДСУМОК ── */}
    {tab==="summary"&&<>
      <Card>
        <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>⚙️ Параметри</div>

        {/* ПУНКТ 1 — вибір моделі */}
        <Lbl>Модель будинку</Lbl>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
          {availableModels.map(m=><button key={m} onClick={()=>setModel(m)}
            style={{padding:"6px 14px",borderRadius:10,border:`2px solid ${model===m?"#3b82f6":"#e2e8f0"}`,background:model===m?"#eff6ff":"#fff",cursor:"pointer",fontSize:12,fontWeight:model===m?700:400,color:model===m?"#3b82f6":"#475569"}}>
            {m}
          </button>)}
        </div>
        {bom.length===0&&<div style={{fontSize:11,color:"#f59e0b",marginBottom:8}}>⚠️ BOM для моделі {model} не заповнений</div>}
        {bom.length>0&&<div style={{fontSize:11,color:"#10b981",marginBottom:8}}>✅ {bom.length} позицій в BOM · Матеріали: ₴{fmt(matOpt)}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
          <div><Lbl>Кількість</Lbl><Input type="number" value={qty} onChange={v=>setQty(Math.max(1,+v))}/></div>
          <div><Lbl>Маржа: <strong style={{color:"#10b981"}}>{margin}%</strong></Lbl>
            <input type="range" min="15" max="60" value={margin} onChange={e=>setMargin(+e.target.value)} style={{width:"100%",accentColor:"#10b981",marginTop:8}}/>
          </div>
        </div>

        {/* ПУНКТ 3 — схема оплати бригади */}
        <Lbl>Оплата бригади</Lbl>
        <div style={{display:"flex",gap:6,marginBottom:8}}>
          {[{v:"fixed",l:"Фіксована"},{v:"perSqm",l:"По м²"},{v:"ops",l:"По операціях"}].map(s=>(
            <button key={s.v} onClick={()=>setLabourScheme(s.v)}
              style={{flex:1,padding:"6px",border:"none",borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:labourScheme===s.v?700:400,background:labourScheme===s.v?"#1e293b":"#e2e8f0",color:labourScheme===s.v?"#fff":"#64748b"}}>
              {s.l}
            </button>
          ))}
        </div>
        {labourScheme==="fixed"&&<Sel value={labourFixed} onChange={v=>setLabourFixed(+v)} options={[70000,100000,107500,125000,150000,175000].map(v=>({v,l:`₴${fmt(v)}${v===150000?" ✓":""}`}))}/>}
        {labourScheme==="perSqm"&&<div style={{fontSize:11,color:"#06b6d4",background:"#f0f9ff",borderRadius:8,padding:"6px 10px"}}>
          Підлога {floorArea}м²×900 + Стіни {extWallArea}м²×700 + Покрівля {roofArea}м²×900 = <strong>₴{fmt(laborCostSqm)}</strong>
        </div>}
        {labourScheme==="ops"&&<div style={{fontSize:11,color:"#8b5cf6",background:"#f5f3ff",borderRadius:8,padding:"6px 10px"}}>
          По виконавцях: <strong>₴{fmt(laborCostOps)}</strong> ({totalHours} год)
        </div>}
      </Card>

      {/* РЕЗУЛЬТАТ */}
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:14}}>КАЛЬКУЛЯЦІЯ · {qty} од. · {model}</div>
        {[
          {l:"🪵 Матеріали (опт)",       v:matOpt*qty,       c:"#f59e0b", sub:`Економія ₴${fmt(saving*qty)} vs роздріб`},
          {l:"👷 Праця бригади",          v:laborCost*qty,    c:"#06b6d4", sub:labourScheme==="fixed"?`Фіксована`:labourScheme==="perSqm"?`По м²`:`По операціях (${totalHours}год)`},
          {l:"📋 Накладні 6%",            v:overhead6*qty,    c:"#8b5cf6"},
          {l:"СОБІВАРТІСТЬ",              v:cost*qty,          c:"#e2e8f0", bold:true},
          {l:`ЦІНА (${margin}%)`,         v:price*qty,         c:"#10b981", big:true},
          {l:"МАРЖА ₴",                   v:(price-cost)*qty,  c:"#22c55e", bold:true},
        ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:i<5?"1px solid #ffffff10":"none"}}>
          <div><div style={{fontSize:x.bold||x.big?12:11,color:x.bold||x.big?"#cbd5e1":"#94a3b8"}}>{x.l}</div>{x.sub&&<div style={{fontSize:9,color:"#475569",marginTop:1}}>{x.sub}</div>}</div>
          <div style={{fontSize:x.big?22:x.bold?16:14,fontWeight:x.big?900:x.bold?700:600,color:x.c}}>₴{fmt(Math.round(x.v))}</div>
        </div>)}
      </Card>

      {/* ПУНКТ 4 — з офісними витратами */}
      {overheadPerUnit>0&&<Card style={{borderLeft:"3px solid #ef4444"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>🏢 З офісними витратами місяця</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <div style={{background:"#fef2f2",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#94a3b8"}}>Накладні на проєкт</div>
            <div style={{fontSize:14,fontWeight:800,color:"#ef4444"}}>₴{fmt(overheadPerUnit)}</div>
          </div>
          <div style={{background:"#f0fdf4",borderRadius:8,padding:"8px 10px"}}>
            <div style={{fontSize:9,color:"#94a3b8"}}>Реальна маржа</div>
            <div style={{fontSize:14,fontWeight:800,color:Math.round((priceWithOverhead-costWithOverhead)/priceWithOverhead*100)>=20?"#10b981":"#ef4444"}}>
              {Math.round((price-costWithOverhead)/price*100)}%
            </div>
          </div>
        </div>
      </Card>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn onClick={()=>setSaveModal(true)} color="#10b981" full>💾 Зберегти</Btn>
        <Btn onClick={()=>{
          const win=window.open("","_blank");
win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>КП</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8fafc;padding:8px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:12px}td{padding:8px;border-bottom:1px solid #f9fafb;font-size:13px}.price{font-weight:900;color:#10b981;font-size:22px}</style></head><body> <h1>🏗️ МОДУЛЕР ПРО — КП</h1> <p>${new Date().toLocaleDateString("uk-UA")} · Модель ${model} · ${qty} од.</p> <table><tr><th>Стаття</th><th>Сума</th></tr> <tr><td>Матеріали (опт)</td><td>₴${fmt(matOpt*qty)}</td></tr> <tr><td>Праця бригади</td><td>₴${fmt(laborCost*qty)}</td></tr> <tr><td>Накладні</td><td>₴${fmt(overhead6*qty)}</td></tr> <tr><td><b>Собівартість</b></td><td><b>₴${fmt(cost*qty)}</b></td></tr> <tr><td colspan="2" style="text-align:center;padding:16px"><span class="price">Ціна: ₴${fmt(price*qty)}</span></td></tr></table> <p>Схема: 10% бронювання · 40% старт · 30% коробка · 20% здача</p> </body></html>`);
          win.document.close();win.print();
        }} color="#6366f1" full>📄 КП</Btn>
      </div>
    </>}

    {/* ── ПОРІВНЯННЯ СХЕМ ОПЛАТИ (ПУНКТ 3) ── */}
    {tab==="compare"&&<>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Порівняння трьох схем оплати бригади для моделі {model}</div>
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:12}}>МАТЕРІАЛИ (однакові для всіх схем)</div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{color:"#94a3b8",fontSize:11}}>Опт</span>
          <span style={{fontWeight:700,color:"#f59e0b"}}>₴{fmt(matOpt)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
          <span style={{color:"#94a3b8",fontSize:11}}>Економія vs роздріб</span>
          <span style={{fontWeight:700,color:"#22c55e"}}>₴{fmt(saving)}</span>
        </div>
      </Card>

      {[
        {v:"fixed",  l:"Фіксована",    labour:labourFixed,  desc:`₴${fmt(labourFixed)} за будинок`},
        {v:"perSqm", l:"По м²",        labour:laborCostSqm, desc:`${floorArea}м²×900 + ${extWallArea}м²×700 + ${roofArea}м²×900`},
        {v:"ops",    l:"По операціях", labour:laborCostOps, desc:`${totalHours}год × середня ставка`},
      ].map(scheme=>{
        const c_=matOpt+scheme.labour+Math.round((matOpt+scheme.labour)*0.06);
        const p_=Math.round(c_*(1+margin/100));
        const m_=p_-c_;
        const mPct_=Math.round(m_/p_*100);
        return <Card key={scheme.v} style={{borderLeft:`3px solid ${mPct_>=25?"#10b981":mPct_>=15?"#f59e0b":"#ef4444"}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:13}}>{scheme.l}</div>
            <Badge color={mPct_>=25?"#10b981":mPct_>=15?"#f59e0b":"#ef4444"}>Маржа {mPct_}%</Badge>
          </div>
          <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>{scheme.desc}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[{l:"Праця",v:"₴"+fmt(scheme.labour),c:"#06b6d4"},{l:"Собівартість",v:"₴"+fmt(c_),c:"#e11d48"},{l:"Ціна",v:"₴"+fmt(p_),c:"#10b981"}].map((x,i)=>(
              <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px"}}>
                <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
                <div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
        </Card>;
      })}
    </>}

    {/* ── ФАЗИ ── */}
    {tab==="phases"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:12,color:"#64748b"}}>Праця: <strong style={{color:"#06b6d4"}}>₴{fmt(laborCostOps)}</strong> · {totalHours}год</div>
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

    {/* ── МАТЕРІАЛИ З ПОСТАЧАЛЬНИКАМИ (ПУНКТ 5) ── */}
    {tab==="materials"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div style={{fontSize:11,color:"#94a3b8"}}>BOM {model} · {bom.length} позицій</div>
        <div style={{fontWeight:700,fontSize:12,color:"#10b981"}}>₴{fmt(matOpt)}</div>
      </div>
      {bom.map(item=>{
        const mat=materials.find(m=>m.id===item.material_id);
        if(!mat)return null;
        const best=getBestSupplier(mat.id);
        const total=mat.opt_price*item.qty;
        return <Card key={item.id} style={{padding:"9px 12px",margin:"0 0 6px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600}}>{mat.name}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{item.qty} {mat.unit} · {item.note}</div>
              {best&&<div style={{fontSize:10,color:"#10b981",marginTop:2}}>
                ✅ {best.supplier}
                {best.savings>0&&<span style={{color:"#f59e0b"}}> (економія ₴{fmt(best.savings*item.qty)})</span>}
              </div>}
              {!best&&mat.supplier&&<div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>📦 {mat.supplier}</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
              <div style={{fontWeight:700,color:"#10b981",fontSize:12}}>₴{fmt(total)}</div>
              {best&&best.price*item.qty<total&&<div style={{fontSize:9,color:"#f59e0b"}}>найкраща ₴{fmt(best.price*item.qty)}</div>}
              <div style={{fontSize:9,color:"#94a3b8"}}>роздріб ₴{fmt(mat.retail_price*item.qty)}</div>
            </div>
          </div>
        </Card>;
      })}
      {bom.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>BOM для моделі {model} порожній</div>}
    </>}

    {/* MODALS */}
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

    {saveModal&&<Modal title="Зберегти як продукт" onClose={()=>setSaveModal(false)}>
      <div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 14px",marginBottom:14,fontSize:12,color:"#166534"}}>
        Модель {model} · Ціна <strong>₴{fmt(price*qty)}</strong> · Маржа <strong>{margin}%</strong>
        {overheadPerUnit>0&&<div style={{marginTop:4,color:"#b45309"}}>Реальна маржа з накладними: {Math.round((price-costWithOverhead)/price*100)}%</div>}
      </div>
      <Lbl>Назва продукту</Lbl>
      <Input value={saveName} onChange={setSaveName} placeholder={`Каркасний ${model} Стандарт`}/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setSaveModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          if(!saveName.trim())return;
          await productsH.create({name:saveName,description:`Модель ${model} · ${labourScheme==="fixed"?`Бригада ₴${fmt(labourFixed)}`:"По м²"}`,model,status:"draft",sale_price:price*qty,cost_price:cost*qty,margin_pct:margin,notes:`Матеріали: ₴${fmt(matOpt*qty)}\nПраця: ₴${fmt(laborCost*qty)}\nНакладні: ₴${fmt(overhead6*qty)}${overheadPerUnit>0?`\nОфісні: ₴${fmt(overheadPerUnit*qty)}`:""}`,version:"1.0",valid_date:today()});
          setSaveModal(false);setSaveName("");
        }} color="#10b981" style={{flex:2}}>💾 Зберегти в каталог</Btn>
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
        <Btn onClick={()=>{setWForm({name:"",rate:0,pay_model:"sqm",pay_rate:0,pay_unit:"м²",category:"Каркас",note:""});setWModal("add");}} small color="#8b5cf6">+ Виконавець</Btn>
      </div>

      {/* Підсумок по категоріях */}
      <Card style={{background:"#f8fafc",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:700,color:"#64748b",marginBottom:8}}>МОДЕЛЬ ОПЛАТИ</div>
        {[
          {model:"sqm",    l:"📐 По м²",       c:"#3b82f6"},
          {model:"fixed",  l:"📦 Фіксована",   c:"#10b981"},
          {model:"salary", l:"💼 Оклад/міс",   c:"#8b5cf6"},
          {model:"hourly", l:"⏱ Погодинна",    c:"#f59e0b"},
        ].map(({model,l,c})=>{
          const ww=workers.filter(w=>w.pay_model===model);
          if(!ww.length)return null;
          return <div key={model} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0",borderBottom:"1px solid #f1f5f9"}}>
            <span style={{fontSize:11,color:"#475569"}}>{l} ({ww.length})</span>
            <span style={{fontSize:11,fontWeight:600,color:c}}>
              {ww.map(w=>`${w.name}: ₴${fmt(w.pay_rate||w.rate)}/${w.pay_unit||"год"}`).join(" · ")}
            </span>
          </div>;
        })}
      </Card>

      {workers.map(w=>{
        const PAY_ICONS={sqm:"📐",fixed:"📦",salary:"💼",hourly:"⏱"};
        const PAY_COLORS={sqm:"#3b82f6",fixed:"#10b981",salary:"#8b5cf6",hourly:"#f59e0b"};
        const payModel=w.pay_model||"hourly";
        const payRate=w.pay_rate||w.rate;
        const payUnit=w.pay_unit||"год";
        const payColor=PAY_COLORS[payModel]||"#8b5cf6";
        return <Card key={w.id} style={{padding:"10px 14px",margin:"0 0 8px",borderLeft:`3px solid ${payColor}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>{w.name}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{w.category}</div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontWeight:800,fontSize:14,color:payColor}}>
                {PAY_ICONS[payModel]} ₴{fmt(payRate)}<span style={{fontSize:10,color:"#94a3b8"}}>/{payUnit}</span>
              </div>
            </div>
          </div>
          {w.note&&<div style={{fontSize:10,color:"#64748b",background:"#f8fafc",borderRadius:6,padding:"4px 8px",marginBottom:6,lineHeight:1.5}}>{w.note}</div>}
          {w.notes&&<div style={{fontSize:10,color:"#475569",background:"#f0f9ff",borderRadius:6,padding:"4px 8px",marginBottom:6}}>💬 {w.notes}</div>}
          <div style={{display:"flex",gap:5,justifyContent:"flex-end"}}>
            <button onClick={()=>setHistModal(w)} style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>📝 Нотатка</button>
            <button onClick={()=>{setWForm({...w});setWModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>✏️</button>
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
      <Lbl>Назва (посада)</Lbl>
      <Input value={wForm.name} onChange={v=>setWForm(p=>({...p,name:v}))} placeholder="Тесляр / каркасник"/>

      <Lbl>Категорія</Lbl>
      <Sel value={wForm.category} onChange={v=>setWForm(p=>({...p,category:v}))} options={["Каркас","Утеплення","Покрівля","Фасад","Оздоблення","Комунікації","Загальне","Проєкт","Управління"].map(v=>({v,l:v}))}/>

      <Lbl>Модель оплати</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        {[
          {v:"sqm",    l:"📐 По м²"},
          {v:"fixed",  l:"📦 Фіксована"},
          {v:"salary", l:"💼 Оклад/міс"},
          {v:"hourly", l:"⏱ Погодинна"},
        ].map(opt=><button key={opt.v} onClick={()=>setWForm(p=>({...p,pay_model:opt.v}))}
          style={{padding:"7px",border:`2px solid ${wForm.pay_model===opt.v?"#8b5cf6":"#e2e8f0"}`,borderRadius:10,background:wForm.pay_model===opt.v?"#f5f3ff":"#fff",cursor:"pointer",fontSize:11,fontWeight:wForm.pay_model===opt.v?700:400,color:wForm.pay_model===opt.v?"#7c3aed":"#475569"}}>
          {opt.l}
        </button>)}
      </div>

      {wForm.pay_model==="sqm"&&<>
        <Lbl>Ціна за м² (₴)</Lbl>
        <Input type="number" value={wForm.pay_rate||0} onChange={v=>setWForm(p=>({...p,pay_rate:+v,rate:+v}))} placeholder="900"/>
        <Lbl>Що вимірюється</Lbl>
        <Sel value={wForm.pay_unit||"м²"} onChange={v=>setWForm(p=>({...p,pay_unit:v}))} options={["м² стін","м² підлоги","м² покрівлі","м² фасаду","м²"].map(v=>({v,l:v}))}/>
      </>}

      {wForm.pay_model==="fixed"&&<>
        <Lbl>Фіксована сума за будинок (₴)</Lbl>
        <Input type="number" value={wForm.pay_rate||0} onChange={v=>setWForm(p=>({...p,pay_rate:+v,rate:+v}))} placeholder="20000"/>
      </>}

      {wForm.pay_model==="salary"&&<>
        <Lbl>Оклад на місяць (₴)</Lbl>
        <Input type="number" value={wForm.pay_rate||0} onChange={v=>setWForm(p=>({...p,pay_rate:+v,rate:+v}))} placeholder="35000"/>
        <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>Розподіляється між проєктами як офісні витрати</div>
      </>}

      {wForm.pay_model==="hourly"&&<>
        <Lbl>Ставка (₴/год)</Lbl>
        <Input type="number" value={wForm.rate||0} onChange={v=>setWForm(p=>({...p,rate:+v,pay_rate:+v}))} placeholder="150"/>
      </>}

      <Lbl>Нотатка / умови</Lbl>
      <Input value={wForm.note} onChange={v=>setWForm(p=>({...p,note:v}))} placeholder="Деталі оплати, умови..."/>

      {/* Підсумок */}
      {(wForm.pay_rate||wForm.rate)>0&&<div style={{background:"#f5f3ff",borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:"#7c3aed",fontWeight:600}}>
        {wForm.pay_model==="sqm"&&`По м²: ₴${fmt(wForm.pay_rate)}/${wForm.pay_unit||"м²"}`}
        {wForm.pay_model==="fixed"&&`Фіксована: ₴${fmt(wForm.pay_rate)} за будинок`}
        {wForm.pay_model==="salary"&&`Оклад: ₴${fmt(wForm.pay_rate)}/міс → розподіл між проєктами`}
        {wForm.pay_model==="hourly"&&`Погодинна: ₴${fmt(wForm.rate)}/год`}
      </div>}

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

// ─── PROJECT SPECIFICATION ────────────────────────────────────────────────────
function ProjectSpec({project,bom,materials,procH,projectsH}){
  const [generating,setGenerating]=useState(false);
  const [areas,setAreas]=useState({
    floor_area:+project.floor_area||0,
    wall_area:+project.wall_area||0,
    roof_area:+project.roof_area||0,
    facade_area:+project.facade_area||0,
  });
  const [specs,setSpecs]=useState([]);
  const [generated,setGenerated]=useState(false);
  const [tab,setTab]=useState("spec");

  // Коефіцієнти перерахунку BOM на площу
  // BOM 3x6 = 18м² підлоги, 30м² стін, 18м² покрівлі, 25м² фасаду
  const BASE={floor:18, wall:30, roof:18, facade:25};

  function generateSpec(){
    setGenerating(true);
    const floor=areas.floor_area||BASE.floor;
    const wall=areas.wall_area||BASE.wall;
    const roof=areas.roof_area||BASE.roof;
    const facade=areas.facade_area||BASE.facade;

    const generated_=bom.map(item=>{
      const mat=materials.find(m=>m.id===item.material_id);
      if(!mat) return null;

      // Визначаємо тип матеріалу і рахуємо кількість
      let qty=item.qty;
      const name=mat.name.toLowerCase();
      const cat=mat.category?.toLowerCase()||"";

      // Масштабуємо відносно базових площ
      if(cat.includes("утеплення")||name.includes("вата")){
        if(name.includes("підлог")||name.includes("200мм"))
          qty=Math.round(item.qty*(floor/BASE.floor)*1.05);
        else if(name.includes("покрівл"))
          qty=Math.round(item.qty*(roof/BASE.roof)*1.05);
        else
          qty=Math.round(item.qty*(wall/BASE.wall)*1.05);
      } else if(name.includes("паробар")||name.includes("мембран")){
        qty=Math.round(item.qty*((floor+wall+roof)/( BASE.floor+BASE.wall+BASE.roof))*1.1);
      } else if(name.includes("osb")&&name.includes("22")){
        qty=Math.ceil(floor/3.125*1.05);
      } else if(name.includes("osb")&&name.includes("10")){
        qty=Math.ceil(roof/3.125*1.05);
      } else if(cat.includes("деревина")||name.includes("дошка")||name.includes("брус")){
        qty=Math.round(item.qty*(wall/BASE.wall)*1.1);
      } else if(cat.includes("фасад")||name.includes("планкен")||name.includes("термо")){
        qty=Math.round(item.qty*(facade/BASE.facade)*1.15);
      } else if(name.includes("сітка")||name.includes("геотекстил")){
        qty=Math.round(item.qty*(floor/BASE.floor)*1.1);
      } else if(cat.includes("скотч")||cat.includes("герметик")){
        qty=Math.round(item.qty*((floor+wall+roof)/(BASE.floor+BASE.wall+BASE.roof))*1.1);
      }
      // Електрика, сантехніка, вікна — залишаємо як є (комплект)

      return {
        material_id:mat.id,
        material:mat,
        qty_base:item.qty,
        qty:Math.max(1,qty),
        unit:mat.unit,
        total_opt:Math.round(mat.opt_price*Math.max(1,qty)),
        note:item.note,
      };
    }).filter(Boolean);

    setSpecs(generated_);
    setGenerated(true);
    setGenerating(false);
  }

  const totalSpec=specs.reduce((s,i)=>s+i.total_opt,0);

  async function addToProcurement(){
    const toAdd=specs.filter(s=>s.qty>0);
    for(const item of toAdd){
      await procH.create({
        material_id:item.material_id,
        project_id:project.id,
        qty:item.qty,
        status:"pending",
        note:item.note||"",
        supplier:"",
        ordered_date:"",
        expected_date:"",
        price_paid:0,
      });
    }
    await projectsH.update(project.id,{
      ...areas,
      spec_generated_at:new Date().toISOString()
    });
  }

  return <div>
    {/* Площі */}
    <Card style={{borderLeft:"3px solid #3b82f6"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>📐 Площі будинку</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {[
          {k:"floor_area",  l:"Підлога (м²)",    def:18},
          {k:"wall_area",   l:"Стіни зовн. (м²)", def:30},
          {k:"roof_area",   l:"Покрівля (м²)",    def:18},
          {k:"facade_area", l:"Фасад (м²)",       def:25},
        ].map(({k,l,def})=><div key={k}>
          <Lbl>{l}</Lbl>
          <Input type="number" value={areas[k]||def}
            onChange={v=>setAreas(p=>({...p,[k]:+v}))}/>
        </div>)}
      </div>
      {areas.floor_area>0&&<div style={{fontSize:11,color:"#3b82f6",marginTop:8}}>
        Масштаб: ×{(areas.floor_area/18).toFixed(1)} відносно базового 3×6 (18м²)
      </div>}
      <Btn onClick={generateSpec} full color="#3b82f6" style={{marginTop:12}} disabled={generating}>
        {generating?"⟳ Рахую...":"🔄 Згенерувати специфікацію"}
      </Btn>
    </Card>

    {/* Специфікація */}
    {generated&&<>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        {[["spec","📋 Специфікація"],["summary","💰 Підсумок"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
        ))}
      </div>

      {tab==="spec"&&<>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div style={{fontSize:12,color:"#64748b"}}>{specs.length} позицій · ₴{fmt(totalSpec)}</div>
          <Btn onClick={addToProcurement} small color="#10b981">📦 → В закупівлі</Btn>
        </div>

        {[...new Set(specs.map(s=>s.material.category))].map(cat=>{
          const items=specs.filter(s=>s.material.category===cat);
          const catTotal=items.reduce((s,i)=>s+i.total_opt,0);
          return <div key={cat} style={{marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:10,color:"#6366f1",letterSpacing:"0.08em",marginBottom:6,display:"flex",justifyContent:"space-between"}}>
              <span>{cat.toUpperCase()}</span>
              <span style={{color:"#10b981"}}>₴{fmt(catTotal)}</span>
            </div>
            {items.map((item,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f9fafb"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:600}}>{item.material.name}</div>
                <div style={{display:"flex",gap:8,marginTop:2}}>
                  <span style={{fontSize:10,color:"#94a3b8"}}>
                    Базово: {item.qty_base} {item.unit}
                  </span>
                  <span style={{fontSize:10,color:"#3b82f6",fontWeight:600}}>
                    → {item.qty} {item.unit}
                  </span>
                </div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
                <div style={{fontWeight:700,color:"#10b981",fontSize:12}}>₴{fmt(item.total_opt)}</div>
                <div style={{fontSize:9,color:"#94a3b8"}}>₴{item.material.opt_price}/{item.unit}</div>
              </div>
            </div>)}
          </div>;
        })}

        <Card style={{borderTop:"2px solid #e2e8f0",marginTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontWeight:700,fontSize:14}}>Всього матеріали</span>
            <span style={{fontWeight:900,fontSize:18,color:"#10b981"}}>₴{fmt(totalSpec)}</span>
          </div>
          <Btn onClick={addToProcurement} full color="#10b981" style={{marginTop:10}}>
            📦 Додати всі в список закупівель
          </Btn>
        </Card>
      </>}

      {tab==="summary"&&<Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:14}}>СПЕЦИФІКАЦІЯ · {project.name}</div>
        {[...new Set(specs.map(s=>s.material.category))].map(cat=>{
          const items=specs.filter(s=>s.material.category===cat);
          const catTotal=items.reduce((s,i)=>s+i.total_opt,0);
          const pct=Math.round(catTotal/totalSpec*100);
          return <div key={cat} style={{marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
              <span style={{color:"#94a3b8"}}>{cat}</span>
              <span style={{color:"#f59e0b",fontWeight:600}}>₴{fmt(catTotal)} ({pct}%)</span>
            </div>
            <div style={{background:"#ffffff15",borderRadius:99,height:6}}>
              <div style={{width:pct+"%",height:"100%",background:"#f59e0b",borderRadius:99}}/>
            </div>
          </div>;
        })}
        <div style={{borderTop:"1px solid #ffffff20",paddingTop:10,marginTop:4,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:"#94a3b8",fontSize:12}}>РАЗОМ</span>
          <span style={{fontWeight:900,fontSize:18,color:"#10b981"}}>₴{fmt(totalSpec)}</span>
        </div>
      </Card>}
    </>}
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

// ─── PROJECT DOCUMENTS ────────────────────────────────────────────────────────
const DOC_TYPES={
  contract: {l:"📄 Договір",     c:"#6366f1"},
  kp:       {l:"💰 КП",          c:"#10b981"},
  schema:   {l:"📐 Схема/КД",    c:"#3b82f6"},
  photo:    {l:"📷 Фото",        c:"#f59e0b"},
  act:      {l:"✅ Акт",         c:"#22c55e"},
  invoice:  {l:"🧾 Рахунок",     c:"#8b5cf6"},
  other:    {l:"📎 Інше",        c:"#94a3b8"},
};

function ProjectDocuments({project,docsH,user}){
  const {data:allDocs,create:addDoc,remove:removeDoc}=docsH;
  const docs=allDocs.filter(d=>d.project_id===project.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const [uploading,setUploading]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [filter,setFilter]=useState("all");
  const [linkModal,setLinkModal]=useState(false);
  const [linkForm,setLinkForm]=useState({name:"",type:"other",url:"",note:""});

  const filteredDocs=filter==="all"?docs:docs.filter(d=>d.type===filter);

  // Завантаження файлу в Supabase Storage
  async function uploadFile(file){
    if(!file)return;
    setUploading(true);
    setUploadProgress(0);

    try{
      const ext=file.name.split(".").pop();
      const path=`${project.id}/${Date.now()}.${ext}`;
      const url=`${SUPABASE_URL}/storage/v1/object/project-files/${path}`;

      const resp=await fetch(url,{
        method:"POST",
        headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":file.type,"x-upsert":"true"},
        body:file,
      });

      if(!resp.ok)throw new Error("Upload failed");

      const publicUrl=`${SUPABASE_URL}/storage/v1/object/public/project-files/${path}`;

      // Визначаємо тип файлу
      let type="other";
      const name=file.name.toLowerCase();
      if(name.includes("договір")||name.includes("contract"))type="contract";
      else if(name.includes("кп")||name.includes("пропозиц"))type="kp";
      else if(name.includes("схем")||name.includes("план")||name.includes("кд"))type="schema";
      else if(name.includes("фото")||name.includes("photo")||name.match(/\.(jpg|jpeg|png|webp)$/))type="photo";
      else if(name.includes("акт")||name.includes("act"))type="act";
      else if(name.includes("рахун")||name.includes("invoice"))type="invoice";

      await addDoc({
        project_id:project.id,
        name:file.name,
        type,
        url:publicUrl,
        size_kb:Math.round(file.size/1024),
        uploaded_by:user?.name||"Менеджер",
      });

    }catch(e){
      alert("Помилка завантаження: "+e.message);
    }finally{
      setUploading(false);
      setUploadProgress(0);
    }
  }

  const isImage=(url)=>url&&/\.(jpg|jpeg|png|webp|gif)$/i.test(url);

  return <div>
    {/* Завантаження */}
    <Card style={{borderLeft:"3px solid #3b82f6",marginBottom:14}}>
      <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>📤 Додати файл</div>

      {/* Drag & Drop зона */}
      <div
        style={{border:"2px dashed #e2e8f0",borderRadius:12,padding:"20px",textAlign:"center",marginBottom:8,cursor:"pointer",background:uploading?"#f0f9ff":"#f8fafc"}}
        onClick={()=>document.getElementById("file-upload-"+project.id).click()}
        onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#3b82f6";}}
        onDragLeave={e=>{e.currentTarget.style.borderColor="#e2e8f0";}}
        onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="#e2e8f0";const f=e.dataTransfer.files[0];if(f)uploadFile(f);}}>
        <input id={"file-upload-"+project.id} type="file"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
          style={{display:"none"}}
          onChange={e=>e.target.files[0]&&uploadFile(e.target.files[0])}/>
        {uploading?<>
          <div style={{fontSize:20,marginBottom:8}}>⟳</div>
          <div style={{fontSize:12,color:"#3b82f6"}}>Завантаження...</div>
        </>:<>
          <div style={{fontSize:28,marginBottom:6}}>📎</div>
          <div style={{fontSize:12,color:"#64748b"}}>Натисніть або перетягніть файл</div>
          <div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>PDF, Word, JPG, PNG (до 50МБ)</div>
        </>}
      </div>

      {/* Або додати посилання */}
      <button onClick={()=>setLinkModal(true)}
        style={{width:"100%",padding:"7px",border:"1px dashed #94a3b8",borderRadius:10,background:"transparent",cursor:"pointer",fontSize:11,color:"#64748b"}}>
        🔗 Додати посилання (Google Drive, Dropbox...)
      </button>
    </Card>

    {/* Фільтр */}
    {docs.length>0&&<div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:4}}>
      <button onClick={()=>setFilter("all")} style={{flexShrink:0,fontSize:10,padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filter==="all"?"#1e293b":"#e2e8f0",color:filter==="all"?"#fff":"#475569"}}>
        Всі ({docs.length})
      </button>
      {Object.entries(DOC_TYPES).filter(([k])=>docs.some(d=>d.type===k)).map(([k,v])=>(
        <button key={k} onClick={()=>setFilter(k)} style={{flexShrink:0,fontSize:10,padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filter===k?v.c:"#e2e8f0",color:filter===k?"#fff":"#475569"}}>{v.l}</button>
      ))}
    </div>}

    {/* Список документів */}
    {filteredDocs.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>
      {docs.length===0?"Документів ще немає":"Немає документів цього типу"}
    </div>}

    {filteredDocs.map(doc=>{
      const t=DOC_TYPES[doc.type]||DOC_TYPES.other;
      return <Card key={doc.id} style={{margin:"0 0 8px",padding:"10px 12px",borderLeft:`3px solid ${t.c}`}}>
        {/* Превью фото */}
        {isImage(doc.url)&&<div style={{marginBottom:8,borderRadius:8,overflow:"hidden",maxHeight:160}}>
          <img src={doc.url} alt={doc.name} style={{width:"100%",objectFit:"cover",maxHeight:160}} loading="lazy"/>
        </div>}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
              <Badge color={t.c}>{t.l}</Badge>
              {doc.size_kb>0&&<span style={{fontSize:9,color:"#94a3b8"}}>{doc.size_kb}КБ</span>}
            </div>
            <div style={{fontSize:12,fontWeight:600,color:"#1e293b",marginBottom:2,wordBreak:"break-all"}}>{doc.name}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>👔 {doc.uploaded_by} · {fmtDate(doc.created_at)}</div>
            {doc.note&&<div style={{fontSize:11,color:"#64748b",marginTop:2}}>{doc.note}</div>}
          </div>
          <div style={{display:"flex",gap:5,marginLeft:8,flexShrink:0}}>
            {doc.url&&<a href={doc.url} target="_blank" rel="noopener noreferrer"
              style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#3b82f6",textDecoration:"none",fontWeight:600}}>
              ↗ Відкрити
            </a>}
            <button onClick={()=>confirm("Видалити документ?")&&removeDoc(doc.id)}
              style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>🗑</button>
          </div>
        </div>
      </Card>;
    })}

    {/* Modal для посилання */}
    {linkModal&&<Modal title="Додати посилання" onClose={()=>setLinkModal(false)}>
      <Lbl>Назва файлу</Lbl><Input value={linkForm.name} onChange={v=>setLinkForm(p=>({...p,name:v}))} placeholder="Договір підряду.pdf"/>
      <Lbl>Тип</Lbl><Sel value={linkForm.type} onChange={v=>setLinkForm(p=>({...p,type:v}))} options={Object.entries(DOC_TYPES).map(([v,d])=>({v,l:d.l}))}/>
      <Lbl>Посилання</Lbl><Input value={linkForm.url} onChange={v=>setLinkForm(p=>({...p,url:v}))} placeholder="https://drive.google.com/..."/>
      <Lbl>Нотатка</Lbl><Input value={linkForm.note} onChange={v=>setLinkForm(p=>({...p,note:v}))} placeholder="Опис..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setLinkModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          if(!linkForm.name||!linkForm.url)return;
          await addDoc({project_id:project.id,...linkForm,size_kb:0,uploaded_by:user?.name||"Менеджер"});
          setLinkModal(false);setLinkForm({name:"",type:"other",url:"",note:""});
        }} color="#3b82f6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── LUMBER TRACKING ──────────────────────────────────────────────────────────
function LumberTracking({project,lumberH}){
  const {data:allLumber,create,remove}=lumberH;
  const lumber=allLumber.filter(l=>l.project_id===project.id);
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({date:today(),type:"delivery",material:"50×150мм (стійки)",volume_m3:0,length_mp:0,supplier:"ЛісоПром",cost:0,treated:false,note:""});
  const [tab,setTab]=useState("summary");

  const TYPES={
    delivery:  {l:"📦 Прихід",      c:"#3b82f6"},
    usage:     {l:"🪚 Витрата",     c:"#f59e0b"},
    waste:     {l:"♻️ Відходи",    c:"#94a3b8"},
    treatment: {l:"🛡 Вогнезахист", c:"#10b981"},
  };

  const MATERIALS=["50×150мм (стійки)","50×200мм (лаги/крокви)","50×100мм (внутр. стіни)","20×100мм (підшивка)","40×50мм (брусок)","Брус 150×150мм"];

  // Зведення по матеріалах
  const summary=MATERIALS.map(mat=>{
    const delivered=lumber.filter(l=>l.material===mat&&l.type==="delivery").reduce((s,l)=>s+ +l.volume_m3,0);
    const used=lumber.filter(l=>l.material===mat&&l.type==="usage").reduce((s,l)=>s+ +l.volume_m3,0);
    const waste=lumber.filter(l=>l.material===mat&&l.type==="waste").reduce((s,l)=>s+ +l.volume_m3,0);
    const treated=lumber.filter(l=>l.material===mat&&l.treated).reduce((s,l)=>s+ +l.volume_m3,0);
    const remaining=delivered-used-waste;
    if(delivered===0)return null;
    return {mat,delivered,used,waste,treated,remaining};
  }).filter(Boolean);

  const totalCost=lumber.filter(l=>l.type==="delivery").reduce((s,l)=>s+ +l.cost,0);
  const treatmentCost=lumber.filter(l=>l.type==="treatment").reduce((s,l)=>s+ +l.cost,0);
  const untreated=lumber.filter(l=>l.type==="delivery"&&!l.treated);

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["summary","📊 Зведення"],["log","📋 Журнал"],["treatment","🛡 Вогнезахист"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── ЗВЕДЕННЯ ── */}
    {tab==="summary"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {l:"Отримано матеріалів",v:"₴"+fmt(totalCost),c:"#3b82f6"},
          {l:"Вогнезахист",       v:"₴"+fmt(treatmentCost),c:"#10b981"},
        ].map((x,i)=><Card key={i} style={{margin:0,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div>
          <div style={{fontSize:14,fontWeight:800,color:x.c}}>{x.v}</div>
        </Card>)}
      </div>

      {untreated.length>0&&<div style={{background:"#fef3c7",border:"1px solid #fde68a",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#b45309"}}>
        ⚠️ {untreated.length} партій деревини не оброблено вогнезахистом!
      </div>}

      {summary.map(s=><Card key={s.mat} style={{margin:"0 0 8px",padding:"10px 12px"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>{s.mat}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
          {[
            {l:"Прийшло",  v:s.delivered.toFixed(2)+"м³",c:"#3b82f6"},
            {l:"Витрачено",v:s.used.toFixed(2)+"м³",     c:"#f59e0b"},
            {l:"Відходи",  v:s.waste.toFixed(2)+"м³",    c:"#94a3b8"},
            {l:"Залишок",  v:s.remaining.toFixed(2)+"м³",c:s.remaining<0?"#ef4444":"#10b981"},
          ].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
            <div style={{fontSize:8,color:"#94a3b8"}}>{x.l}</div>
            <div style={{fontSize:11,fontWeight:700,color:x.c}}>{x.v}</div>
          </div>)}
        </div>
        {s.remaining<0&&<div style={{fontSize:10,color:"#ef4444",marginTop:6}}>⚠️ Нестача! Потрібно дозамовити</div>}
        <div style={{marginTop:6}}>
          <PBar value={s.delivered>0?Math.round(s.used/s.delivered*100):0} color="#f59e0b" height={4}/>
          <div style={{fontSize:9,color:"#94a3b8",marginTop:2}}>Використано {s.delivered>0?Math.round(s.used/s.delivered*100):0}%</div>
        </div>
      </Card>)}

      <Btn onClick={()=>setModal(true)} full color="#3b82f6" style={{marginTop:4}}>+ Новий запис</Btn>
    </>}

    {/* ── ЖУРНАЛ ── */}
    {tab==="log"&&<>
      <Btn onClick={()=>setModal(true)} small style={{marginBottom:12}}>+ Запис</Btn>
      {[...lumber].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(l=>{
        const t=TYPES[l.type]||TYPES.delivery;
        return <Card key={l.id} style={{margin:"0 0 6px",padding:"9px 12px",borderLeft:`3px solid ${t.c}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",gap:5,marginBottom:3}}>
                <Badge color={t.c}>{t.l}</Badge>
                <span style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(l.date)}</span>
              </div>
              <div style={{fontSize:12,fontWeight:600}}>{l.material}</div>
              <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>
                {+l.volume_m3>0&&`${l.volume_m3}м³`}
                {+l.length_mp>0&&` · ${l.length_mp}м.п.`}
                {l.supplier&&` · ${l.supplier}`}
              </div>
              {l.note&&<div style={{fontSize:10,color:"#64748b",marginTop:2}}>{l.note}</div>}
              {l.treated&&<div style={{fontSize:10,color:"#10b981",marginTop:2}}>🛡 Оброблено вогнезахистом</div>}
            </div>
            <div style={{textAlign:"right",flexShrink:0,marginLeft:8}}>
              {+l.cost>0&&<div style={{fontWeight:700,fontSize:12,color:"#3b82f6"}}>₴{fmt(+l.cost)}</div>}
              <button onClick={()=>remove(l.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"3px 6px",cursor:"pointer",fontSize:10,marginTop:4}}>🗑</button>
            </div>
          </div>
        </Card>;
      })}
      {lumber.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Журнал порожній</div>}
    </>}

    {/* ── ВОГНЕЗАХИСТ ── */}
    {tab==="treatment"&&<>
      <Card style={{borderLeft:"3px solid #10b981",marginBottom:12}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>🛡 Вогнезахист деревини</div>
        <div style={{fontSize:11,color:"#64748b",lineHeight:1.7}}>
          <div>• Корито застеляємо плівкою</div>
          <div>• Розводимо вогнезахист в теплій воді</div>
          <div>• Замочуємо дошку — мінімум 15 хвилин</div>
          <div>• Ціна обробки: <strong>850-1000 грн/м³</strong></div>
        </div>
      </Card>

      {lumber.filter(l=>l.type==="delivery").map(l=><Card key={l.id} style={{margin:"0 0 8px",borderLeft:`3px solid ${l.treated?"#10b981":"#f59e0b"}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:12,fontWeight:600}}>{l.material}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>{l.volume_m3}м³ · {fmtDate(l.date)} · {l.supplier}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {l.treated
              ?<Badge color="#10b981">✅ Оброблено</Badge>
              :<Btn small color="#f59e0b" onClick={async()=>{
                await create({
                  project_id:project.id,
                  date:today(),
                  type:"treatment",
                  material:l.material,
                  volume_m3:l.volume_m3,
                  length_mp:l.length_mp,
                  cost:Math.round(+l.volume_m3*900),
                  note:`Вогнезахист партії від ${fmtDate(l.date)}`,
                  treated:true,
                });
                // Позначаємо оригінальну партію як оброблену
                // (потрібно update — але lumberH.update не передали, робимо через patch)
                await fetch(`${SUPABASE_URL}/rest/v1/lumber_log?id=eq.${l.id}`,{
                  method:"PATCH",headers:H,body:JSON.stringify({treated:true,treated_at:new Date().toISOString()})
                });
                lumberH.reload();
              }}>🛡 Обробити</Btn>}
          </div>
        </div>
      </Card>)}
    </>}

    {/* Modal */}
    {modal&&<Modal title="Новий запис деревини" onClose={()=>setModal(false)}>
      <Lbl>Тип операції</Lbl>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
        {Object.entries(TYPES).map(([k,v])=><button key={k} onClick={()=>setForm(p=>({...p,type:k}))}
          style={{padding:"7px",border:`2px solid ${form.type===k?v.c:"#e2e8f0"}`,borderRadius:10,background:form.type===k?v.c+"15":"#fff",cursor:"pointer",fontSize:11,fontWeight:form.type===k?700:400,color:form.type===k?v.c:"#475569"}}>
          {v.l}
        </button>)}
      </div>
      <Lbl>Матеріал</Lbl>
      <Sel value={form.material} onChange={v=>setForm(p=>({...p,material:v}))} options={MATERIALS.map(v=>({v,l:v}))}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <div><Lbl>Об'єм (м³)</Lbl><Input type="number" value={form.volume_m3} onChange={v=>setForm(p=>({...p,volume_m3:+v}))}/></div>
        <div><Lbl>Метраж (м.п.)</Lbl><Input type="number" value={form.length_mp} onChange={v=>setForm(p=>({...p,length_mp:+v}))}/></div>
      </div>
      {form.type==="delivery"&&<><Lbl>Постачальник</Lbl><Input value={form.supplier} onChange={v=>setForm(p=>({...p,supplier:v}))} placeholder="ЛісоПром"/></>}
      <Lbl>Вартість (₴)</Lbl><Input type="number" value={form.cost} onChange={v=>setForm(p=>({...p,cost:+v}))} placeholder="0"/>
      <Lbl>Дата</Lbl><Input type="date" value={form.date} onChange={v=>setForm(p=>({...p,date:v}))}/>
      <Lbl>Нотатка</Lbl><Input value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Деталі..."/>
      {form.volume_m3>0&&form.type==="delivery"&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"8px 12px",marginTop:8,fontSize:12,color:"#166534"}}>
        💰 Орієнтовна вартість вогнезахисту: ₴{fmt(Math.round(+form.volume_m3*900))}
      </div>}
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          await create({...form,project_id:project.id});
          setModal(false);
          setForm({date:today(),type:"delivery",material:"50×150мм (стійки)",volume_m3:0,length_mp:0,supplier:"ЛісоПром",cost:0,treated:false,note:""});
        }} color="#3b82f6" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── PROJECT CHECKLIST ────────────────────────────────────────────────────────
function ProjectChecklist({project,operations,checklistH,user}){
  const {data:allChecks,create:createCheck,update:updateCheck,remove:removeCheck}=checklistH;
  const checks=allChecks.filter(c=>c.project_id===project.id).sort((a,b)=>a.sort_order-b.sort_order);
  const [generating,setGenerating]=useState(false);
  const [expandPhase,setExpandPhase]=useState(null);
  const [addNote,setAddNote]=useState(null);
  const [noteText,setNoteText]=useState("");

  const phases=[...new Set(checks.map(c=>c.phase))];
  const totalDone=checks.filter(c=>c.done).length;
  const totalCrit=checks.filter(c=>c.is_critical&&!c.done).length;
  const pct=checks.length>0?Math.round(totalDone/checks.length*100):0;

  // Генеруємо чеклист з operations
  async function generate(){
    setGenerating(true);
    // Видаляємо старий якщо є
    for(const c of checks) await removeCheck(c.id);

    // Додаємо стандартні операції
    const items=[
      // Підготовка
      {phase:"0. Підготовка",name:"Перевірити фундамент / основу",sort:1,is_critical:true},
      {phase:"0. Підготовка",name:"Обробити деревину вогнезахистом",sort:2,is_critical:true},
      {phase:"0. Підготовка",name:"Перевірити комплектність матеріалів",sort:3,is_critical:false},

      // З operations
      ...operations.sort((a,b)=>a.sort_order-b.sort_order).map((op,i)=>({
        phase:op.phase,
        name:op.name,
        sort:op.sort_order||i+10,
        is_critical:op.note?.includes("‼️")||op.note?.includes("КРИТИЧНО")||false,
      })),

      // Критичні точки контролю
      {phase:"⚠️ Контроль якості",name:"Паробар'єр — всі стики бутилкаучуковим скотчем",sort:90,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"Паробар'єр — обходи комунікацій герметизовані",sort:91,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"Мембрана зовні — стики армованим скотчем",sort:92,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"Вентзазори не перекриті (зовні 30мм, всередині 40мм)",sort:93,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"ПВХ покрівля — мембрана припаяна по периметру",sort:94,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"Уклон покрівлі мінімум 2см/м",sort:95,is_critical:true},
      {phase:"⚠️ Контроль якості",name:"Всі електролінії в гофрорукаві",sort:96,is_critical:true},

      // Здача
      {phase:"🏁 Здача",name:"Прибирання об'єкту",sort:100,is_critical:false},
      {phase:"🏁 Здача",name:"Фото-фіксація всіх вузлів",sort:101,is_critical:false},
      {phase:"🏁 Здача",name:"Перевірка електрики (прозвонка)",sort:102,is_critical:true},
      {phase:"🏁 Здача",name:"Перевірка водопроводу (тиск)",sort:103,is_critical:true},
      {phase:"🏁 Здача",name:"Підписання акту здачі",sort:104,is_critical:false},
    ];

    for(const item of items){
      await createCheck({...item,project_id:project.id,done:false});
    }
    setGenerating(false);
  }

  const phaseStats=(ph)=>{
    const phChecks=checks.filter(c=>c.phase===ph);
    const done=phChecks.filter(c=>c.done).length;
    const crit=phChecks.filter(c=>c.is_critical&&!c.done).length;
    return {total:phChecks.length,done,crit};
  };

  if(checks.length===0) return <div>
    <div style={{textAlign:"center",padding:30}}>
      <div style={{fontSize:40,marginBottom:12}}>📋</div>
      <div style={{fontWeight:700,fontSize:15,color:"#1e293b",marginBottom:8}}>Чеклист не створено</div>
      <div style={{fontSize:12,color:"#94a3b8",marginBottom:16}}>Система згенерує чеклист по всіх фазах будівництва з урахуванням критичних точок контролю</div>
      <Btn onClick={generate} color="#6366f1" full disabled={generating}>
        {generating?"⟳ Генерую...":"📋 Створити чеклист проєкту"}
      </Btn>
    </div>
  </div>;

  return <div>
    {/* Прогрес */}
    <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div>
          <div style={{fontSize:11,color:"#475569",marginBottom:2}}>ПРОГРЕС БУДІВНИЦТВА</div>
          <div style={{fontSize:24,fontWeight:900,color:pct===100?"#22c55e":"#fff"}}>{pct}%</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:12,color:"#94a3b8"}}>{totalDone}/{checks.length} виконано</div>
          {totalCrit>0&&<div style={{fontSize:11,color:"#ef4444",marginTop:4}}>🔴 {totalCrit} критичних не виконано</div>}
          {totalCrit===0&&totalDone>0&&<div style={{fontSize:11,color:"#10b981",marginTop:4}}>✅ Всі критичні виконані</div>}
        </div>
      </div>
      <div style={{background:"#ffffff20",borderRadius:99,height:10}}>
        <div style={{width:pct+"%",height:"100%",background:pct===100?"#22c55e":"#3b82f6",borderRadius:99,transition:"width .3s"}}/>
      </div>
    </Card>

    {totalCrit>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626"}}>
      🔴 Увага! {totalCrit} критичних пунктів не виконано — перевірте перед закриттям конструкції!
    </div>}

    {/* По фазах */}
    {phases.map(ph=>{
      const phChecks=checks.filter(c=>c.phase===ph);
      const {total,done,crit}=phaseStats(ph);
      const isOpen=expandPhase===ph;
      const phPct=total>0?Math.round(done/total*100):0;

      return <div key={ph} style={{marginBottom:8}}>
        <button onClick={()=>setExpandPhase(isOpen?null:ph)}
          style={{width:"100%",background:"#fff",border:"none",borderRadius:12,padding:"10px 14px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 1px 6px #00000010",borderLeft:`3px solid ${phPct===100?"#10b981":crit>0?"#ef4444":"#3b82f6"}`}}>
          <div style={{textAlign:"left",flex:1}}>
            <div style={{fontWeight:700,fontSize:13}}>{ph}</div>
            <div style={{fontSize:10,color:"#94a3b8",marginTop:2}}>{done}/{total} · {phPct}%{crit>0?` · 🔴 ${crit} критичних`:""}</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:`conic-gradient(${phPct===100?"#10b981":"#3b82f6"} ${phPct*3.6}deg,#f1f5f9 0deg)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:phPct===100?"#10b981":"#3b82f6"}}>{phPct}%</div>
            </div>
            <span style={{fontSize:12,color:"#94a3b8"}}>{isOpen?"▲":"▼"}</span>
          </div>
        </button>

        {isOpen&&<div style={{background:"#f8fafc",borderRadius:"0 0 12px 12px",padding:"8px"}}>
          {phChecks.map(item=><div key={item.id} style={{background:"#fff",borderRadius:10,padding:"10px 12px",marginBottom:6,borderLeft:`3px solid ${item.done?"#10b981":item.is_critical?"#ef4444":"#e2e8f0"}`}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
              <button onClick={async()=>{
                if(!item.done&&item.requires_photo&&!item.photo_url){
                  alert("⚠️ Цей пункт потребує фото-підтвердження! Завантажте фото.");
                  return;
                }
                await updateCheck(item.id,{
                  done:!item.done,
                  done_at:!item.done?new Date().toISOString():null,
                  done_by:!item.done?(user?.name||"Бригада"):null,
                });
              }} style={{width:24,height:24,borderRadius:7,border:`2px solid ${item.done?"#10b981":item.is_critical?"#ef4444":"#e2e8f0"}`,background:item.done?"#10b981":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:14,marginTop:1}}>
                {item.done?"✓":""}
              </button>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:item.is_critical?700:500,color:item.done?"#94a3b8":"#1e293b",textDecoration:item.done?"line-through":"none"}}>
                  {item.is_critical&&!item.done&&<span style={{color:"#ef4444"}}>🔴 </span>}
                  {item.operation_name||item.name}
                  {item.requires_photo&&<span style={{fontSize:9,color:"#f59e0b",marginLeft:4}}>📷</span>}
                </div>

                {item.done&&item.done_by&&<div style={{fontSize:10,color:"#10b981",marginTop:2}}>
                  ✅ {item.done_by} · {item.done_at?new Date(item.done_at).toLocaleDateString("uk-UA"):""}
                </div>}

                {/* Фото превью */}
                {item.photo_url&&<div style={{marginTop:6,borderRadius:8,overflow:"hidden",maxHeight:120}}>
                  <img src={item.photo_url} alt="фото" style={{width:"100%",objectFit:"cover",maxHeight:120}} loading="lazy"/>
                </div>}

                {/* Завантажити фото */}
                {item.requires_photo&&!item.photo_url&&!item.done&&<div style={{marginTop:6}}>
                  <label style={{display:"flex",alignItems:"center",gap:6,padding:"4px 8px",background:"#fef3c7",borderRadius:8,cursor:"pointer",fontSize:10,color:"#b45309",fontWeight:600}}>
                    <input type="file" accept="image/*" capture="environment" style={{display:"none"}}
                      onChange={async e=>{
                        const file=e.target.files[0];
                        if(!file)return;
                        const path=`${project.id}/check_${item.id}_${Date.now()}.${file.name.split(".").pop()}`;
                        const resp=await fetch(`${SUPABASE_URL}/storage/v1/object/project-files/${path}`,{
                          method:"POST",headers:{"apikey":SUPABASE_KEY,"Authorization":`Bearer ${SUPABASE_KEY}`,"Content-Type":file.type},body:file
                        });
                        if(resp.ok){
                          const url=`${SUPABASE_URL}/storage/v1/object/public/project-files/${path}`;
                          await updateCheck(item.id,{photo_url:url});
                        }
                      }}/>
                    📷 Додати фото підтвердження
                  </label>
                </div>}

                {/* Нотатка */}
                {item.note&&<div style={{fontSize:11,color:"#64748b",marginTop:3,background:"#f8fafc",borderRadius:6,padding:"2px 6px"}}>{item.note}</div>}
                {addNote===item.id?<div style={{marginTop:6}}>
                  <div style={{display:"flex",gap:6}}>
                    <Input value={noteText} onChange={setNoteText} placeholder="Нотатка..." style={{flex:1,fontSize:11}}/>
                    <Btn small onClick={async()=>{await updateCheck(item.id,{note:noteText});setAddNote(null);setNoteText("");}}>→</Btn>
                    <Btn small outline color="#94a3b8" onClick={()=>setAddNote(null)}>✕</Btn>
                  </div>
                </div>:<button onClick={()=>{setAddNote(item.id);setNoteText(item.note||"");}}
                  style={{marginTop:4,background:"none",border:"none",color:"#94a3b8",cursor:"pointer",fontSize:10}}>
                  + нотатка
                </button>}
              </div>
            </div>
          </div>)}

          {/* Підпис фази — кнопка для бригадира */}
          {phChecks.every(c=>c.done)&&<div style={{background:"#f0fdf4",borderRadius:10,padding:"10px 12px",marginTop:4,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontSize:12,color:"#166534",fontWeight:600}}>✅ Фаза завершена!</div>
            <Btn small color="#10b981" onClick={async()=>{
              await fetch(`${SUPABASE_URL}/rest/v1/quality_acts`,{
                method:"POST",
                headers:{...H,"Prefer":"return=representation"},
                body:JSON.stringify({project_id:project.id,phase:ph,signed_by:user?.name||"Бригада",status:"signed"})
              });
              alert(`✅ Фаза "${ph}" підписана!`);
            }}>✍️ Підписати фазу</Btn>
          </div>}
        </div>}
      </div>;
    })}

    {/* Кнопка акту здачі */}
    {pct===100&&<Card style={{background:"linear-gradient(135deg,#10b981,#059669)",marginTop:10}}>
      <div style={{fontWeight:700,fontSize:14,color:"#fff",marginBottom:4}}>🏆 Всі пункти виконано!</div>
      <div style={{fontSize:12,color:"#d1fae5",marginBottom:10}}>Об'єкт готовий до здачі клієнту</div>
      <Btn onClick={async()=>{
        await fetch(`${SUPABASE_URL}/rest/v1/quality_acts`,{
          method:"POST",headers:{...H,"Prefer":"return=representation"},
          body:JSON.stringify({project_id:project.id,phase:"Повний об'єкт",signed_by:user?.name||"Бригада",status:"signed",notes:"Всі пункти чеклиста виконані"})
        });
        alert("✅ Акт здачі підписано! Передайте менеджеру для затвердження.");
      }} color="#fff" style={{color:"#059669",fontWeight:700}} full>✍️ Підписати акт здачі</Btn>
    </Card>}

    <div style={{marginTop:10,display:"flex",gap:8}}>
      <Btn onClick={generate} outline color="#6366f1" full small disabled={generating}>
        🔄 Перегенерувати
      </Btn>
    </div>
  </div>;
}

// ─── PROJECT LOG (comments + tasks) ──────────────────────────────────────────
function ProjectLog({project,commentsH,tasksH,user,bomH,materialsH,procH,projectsH,operationsH,checklistH,docsH,lumberH}){
  const {data:allComments,create:createComment}=commentsH;
  const {data:allTasks,create:createTask,update:updateTask,remove:removeTask}=tasksH;
  const bom=(bomH?.data||[]).filter(b=>b.model===project.bom_model||b.model==="3x6");
  const materials=materialsH?.data||[];
  const operations=operationsH?.data||[];
  const [tab,setTab]=useState("log");
  const [msg,setMsg]=useState("");
  const [msgType,setMsgType]=useState("comment");
  const [taskForm,setTaskForm]=useState({text:"",assignee:"Менеджер",due_date:"",priority:"high",category:"Загальне"});

  const comments=allComments.filter(c=>c.project_id===project.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const tasks=allTasks.filter(t=>t.project_id===project.id).sort((a,b)=>a.done-b.done);
  const openTasks=tasks.filter(t=>!t.done).length;

  const typeC={comment:"#3b82f6",update:"#10b981",issue:"#ef4444",log:"#94a3b8"};
  const typeL={comment:"💬 Коментар",update:"✅ Оновлення",issue:"⚠️ Проблема",log:"📋 Лог"};
  const prioC={critical:"#ef4444",high:"#f59e0b",medium:"#3b82f6",low:"#94a3b8"};
  const prioL={critical:"🔴 Критично",high:"🟡 Важливо",medium:"🔵 Середній",low:"⚪ Низький"};

  const now_=()=>new Date().toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"});

  return <div>
    <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["log","💬"],["tasks",`✅(${openTasks})`],["spec","📋"],["check","☑️"],["docs","📁"],["lumber","🪵"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 10px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {tab==="lumber"&&<LumberTracking project={project} lumberH={lumberH}/>}
    {tab==="docs"&&<ProjectDocuments project={project} docsH={docsH} user={user}/>}
    {tab==="check"&&<ProjectChecklist project={project} operations={operations} checklistH={checklistH} user={user}/>}
    {/* ── СПЕЦИФІКАЦІЯ ── */}
    {tab==="spec"&&<ProjectSpec project={project} bom={bom} materials={materials} procH={procH} projectsH={projectsH}/>}

    {/* ── ЛОГ ── */}
    {tab==="log"&&<>
      <Card style={{background:"#f8fafc"}}>
        <Sel value={msgType} onChange={setMsgType} options={Object.entries(typeL).map(([v,l])=>({v,l}))} style={{marginBottom:8}}/>
        <div style={{display:"flex",gap:8}}>
          <Input value={msg} onChange={setMsg} placeholder="Додати запис..." style={{flex:1}}/>
          <Btn onClick={async()=>{
            if(!msg.trim())return;
            await createComment({project_id:project.id,author:user.name,text:msg,type:msgType});
            setMsg("");
          }}>→</Btn>
        </div>
      </Card>
      {comments.map(c=><div key={c.id} style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:8,borderLeft:`3px solid ${typeC[c.type]||"#94a3b8"}`,boxShadow:"0 1px 6px #00000008"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontWeight:700,fontSize:12}}>{c.author}</span>
          <span style={{fontSize:10,color:"#94a3b8"}}>{new Date(c.created_at).toLocaleString("uk-UA",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</span>
        </div>
        <div style={{fontSize:13,color:"#334155",lineHeight:1.5}}>{c.text}</div>
        <div style={{marginTop:4}}><Badge color={typeC[c.type]||"#94a3b8"}>{typeL[c.type]||c.type}</Badge></div>
      </div>)}
      {comments.length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>Поки немає записів</div>}
    </>}

    {/* ── ЗАДАЧІ ── */}
    {tab==="tasks"&&<>
      <Card style={{background:"#f8fafc"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>+ Нова задача</div>
        <Input value={taskForm.text} onChange={v=>setTaskForm(p=>({...p,text:v}))} placeholder="Текст задачі..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
          <Sel value={taskForm.priority} onChange={v=>setTaskForm(p=>({...p,priority:v}))} options={Object.entries(prioL).map(([v,l])=>({v,l}))}/>
          <Sel value={taskForm.assignee} onChange={v=>setTaskForm(p=>({...p,assignee:v}))} options={["Власник","Менеджер","Бригада А","Бригада Б","Іван Коваль","Петро Мельник","Олег Дяченко","Сашко Василенко","Дмитро Петренко","Андрій Сірко"].map(v=>({v,l:v}))}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
          <Sel value={taskForm.category||"Загальне"} onChange={v=>setTaskForm(p=>({...p,category:v}))} options={["Загальне","Каркас","Платформа","Покрівля","Утеплення","Мембрани","Фасад","Електрика","Сантехніка","Оздоблення","Плитка","Логістика","Документи"].map(v=>({v,l:v}))}/>
          <Input type="date" value={taskForm.due_date} onChange={v=>setTaskForm(p=>({...p,due_date:v}))}/>
        </div>
        <Btn onClick={async()=>{
          if(!taskForm.text.trim())return;
          await createTask({...taskForm,project_id:project.id,done:false,category:taskForm.category||"Загальне"});
          setTaskForm({text:"",assignee:"Менеджер",due_date:"",priority:"high",category:"Загальне"});
        }} full style={{marginTop:8}}>+ Додати задачу</Btn>
      </Card>

      {/* Фільтр по категоріях */}
      {tasks.length>0&&<>
        <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:10,paddingBottom:4}}>
          {["Всі",...new Set(tasks.map(t=>t.category||"Загальне"))].map(cat=>(
            <button key={cat} onClick={()=>setTaskForm(p=>({...p,_filter:cat==="Всі"?null:cat}))}
              style={{flexShrink:0,fontSize:10,padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:(!taskForm._filter&&cat==="Всі")||(taskForm._filter===cat)?"#1e293b":"#e2e8f0",color:(!taskForm._filter&&cat==="Всі")||(taskForm._filter===cat)?"#fff":"#475569"}}>
              {cat}
            </button>
          ))}
        </div>

        {tasks.filter(t=>!taskForm._filter||t.category===taskForm._filter).map(t=>(
          <div key={t.id} style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:8,display:"flex",alignItems:"flex-start",gap:10,boxShadow:"0 1px 6px #00000008",opacity:t.done?0.6:1,borderLeft:`3px solid ${prioC[t.priority]||"#94a3b8"}`}}>
            <button onClick={()=>updateTask(t.id,{done:!t.done})} style={{width:22,height:22,borderRadius:6,border:`2px solid ${t.done?"#10b981":"#e2e8f0"}`,background:t.done?"#10b981":"transparent",cursor:"pointer",flexShrink:0,marginTop:1,display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontSize:13}}>
              {t.done?"✓":""}
            </button>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:600,color:"#1e293b",textDecoration:t.done?"line-through":"none"}}>{t.text}</div>
              <div style={{display:"flex",gap:5,marginTop:5,flexWrap:"wrap"}}>
                <Badge color={prioC[t.priority]}>{prioL[t.priority]}</Badge>
                {t.category&&t.category!=="Загальне"&&<Badge color="#6366f1">🏷 {t.category}</Badge>}
                {t.assignee&&<Badge color="#8b5cf6">👤 {t.assignee}</Badge>}
                {t.due_date&&<DL date={t.due_date}/>}
              </div>
            </div>
            <button onClick={()=>removeTask(t.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:14,color:"#94a3b8"}}>🗑</button>
          </div>
        ))}

        {/* Статистика */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:8}}>
          {[{l:"Всього",v:tasks.length,c:"#64748b"},{l:"Відкрито",v:tasks.filter(t=>!t.done).length,c:"#f59e0b"},{l:"Виконано",v:tasks.filter(t=>t.done).length,c:"#10b981"}].map((x,i)=>(
            <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:800,color:x.c}}>{x.v}</div>
              <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
            </div>
          ))}
        </div>
      </>}
      {tasks.length===0&&<div style={{textAlign:"center",color:"#94a3b8",fontSize:13,padding:20}}>Задач немає. Додайте першу!</div>}
    </>}
  </div>;
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
function Projects({hook,user,commentsH,tasksH,teamMembers,membersH,bomH,materialsH,procH,operationsH,checklistH,docsH,lumberH}){
  const {data:projects,loading,saving,create,update,remove}=hook;
  const {data:allComments}=commentsH;
  const {data:allTasks}=tasksH;
  const {data:projectMembers,create:addMember,remove:removeMember}=membersH||{data:[],create:async()=>{},remove:async()=>{}};
  const brigadeMembers=(teamMembers||[]).filter(m=>m.role==="brigade"&&m.status!=="archived");

  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [logProject,setLogProject]=useState(null);
  const [membersModal,setMembersModal]=useState(null);
  const [filter,setFilter]=useState("all");
  const [search,setSearch]=useState("");
  const [sortBy,setSortBy]=useState("deadline"); // deadline, margin, progress, name
  const canEdit=user.role!=="brigade";
  const empty={name:"",client:"",phone:"",stage:"lead",deadline:"",sale_price:0,advance:0,spent:0,progress:0,team:"",manager:"",notes:"",issues:"",bom_model:"3x6"};

  const filtered=[...projects.filter(p=>{
    const ms=filter==="all"||p.stage===filter;
    const mq=!search||p.name?.toLowerCase().includes(search.toLowerCase())||p.client?.toLowerCase().includes(search.toLowerCase());
    return ms&&mq;
  })].sort((a,b)=>{
    if(sortBy==="deadline") return new Date(a.deadline||"9999")-new Date(b.deadline||"9999");
    if(sortBy==="margin"){
      const ma=+a.sale_price- +a.spent; const mb=+b.sale_price- +b.spent;
      return mb-ma;
    }
    if(sortBy==="progress") return +b.progress- +a.progress;
    if(sortBy==="name") return (a.name||"").localeCompare(b.name||"","uk");
    return 0;
  });

  function getProjectMembers(projectId){
    return projectMembers.filter(pm=>pm.project_id===projectId).map(pm=>brigadeMembers.find(m=>m.id===pm.member_id)).filter(Boolean);
  }

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
    <div style={{display:"flex",gap:5,marginBottom:10,alignItems:"center"}}>
      <span style={{fontSize:10,color:"#94a3b8",flexShrink:0}}>Сортування:</span>
      {[["deadline","📅 Дедлайн"],["margin","💰 Маржа"],["progress","📊 %"],["name","🔤 А-Я"]].map(([k,l])=>(
        <button key={k} onClick={()=>setSortBy(k)} style={{flexShrink:0,fontSize:10,padding:"3px 8px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:sortBy===k?"#3b82f6":"#e2e8f0",color:sortBy===k?"#fff":"#475569"}}>{l}</button>
      ))}
    </div>
    {saving&&<div style={{fontSize:11,color:"#3b82f6",textAlign:"center",marginBottom:8}}>⟳ Збереження...</div>}
    {filtered.map(p=>{
      const stage=STAGES.find(s=>s.id===p.stage)||STAGES[0];
      const margin=+p.sale_price- +p.spent;
      const mPct=+p.sale_price>0?Math.round(margin/+p.sale_price*100):0;
      const pComments=allComments.filter(c=>c.project_id===p.id).length;
      const pTasks=allTasks.filter(t=>t.project_id===p.id&&!t.done).length;
      const pMembers=getProjectMembers(p.id);
      return <Card key={p.id} style={{borderLeft:p.issues?`3px solid #f59e0b`:`3px solid ${stage.color}40`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
            <div style={{fontSize:11,color:"#64748b"}}>👤 {p.client} · {p.phone}</div>
          </div>
          {canEdit&&<div style={{display:"flex",gap:5,marginLeft:8}}>
            <button onClick={()=>{setForm({...p});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button>
            <button onClick={()=>confirm("Видалити з бази?")&&remove(p.id)} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>🗑</button>
          </div>}
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
          <Badge color={stage.color}>{stage.emoji} {stage.label}</Badge>
          <DL date={p.deadline}/>
          {p.manager&&<Badge color="#6366f1">👔 {p.manager}</Badge>}
        </div>

        {p.issues&&<div style={{fontSize:11,color:"#b45309",background:"#fef3c7",borderRadius:8,padding:"4px 10px",marginBottom:8}}>⚠️ {p.issues}</div>}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
          {[{l:"Ціна",v:"₴"+fmt(+p.sale_price),c:"#3b82f6"},{l:"Витрати",v:"₴"+fmt(+p.spent),c:"#e11d48"},{l:`Маржа ${mPct}%`,v:"₴"+fmt(margin),c:margin>=0?"#10b981":"#ef4444"}].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px"}}><div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div><div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
        </div>

        {/* Виконавці на проєкті */}
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
            {pMembers.map(m=><div key={m.id} style={{display:"flex",alignItems:"center",gap:4,background:"#f0fdf4",borderRadius:20,padding:"2px 8px 2px 4px",fontSize:10}}>
              <span>{SPEC_EMOJI[m.specialization]||"👷"}</span>
              <span style={{fontWeight:600,color:"#166534"}}>{m.name}</span>
            </div>)}
            {canEdit&&<button onClick={()=>setMembersModal(p)}
              style={{background:"#f1f5f9",border:"1px dashed #94a3b8",borderRadius:20,padding:"2px 8px",fontSize:10,cursor:"pointer",color:"#64748b"}}>
              {pMembers.length>0?"+ Ще":"+ Призначити"}
            </button>}
          </div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8",marginBottom:3}}>
          <span>Готовність</span>
          <span style={{fontWeight:700,color:stage.color}}>{p.progress}%</span>
        </div>
        <PBar value={p.progress} color={stage.color}/>

        <div style={{display:"flex",gap:5,marginTop:10,flexWrap:"wrap",justifyContent:"space-between"}}>
          <div style={{display:"flex",gap:5}}>
            {STAGES.map(s=><button key={s.id} onClick={()=>update(p.id,{stage:s.id})} style={{fontSize:10,padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:p.stage===s.id?700:400,background:p.stage===s.id?s.color:"#f1f5f9",color:p.stage===s.id?"#fff":"#64748b"}}>{s.emoji}</button>)}
          </div>
          <button onClick={()=>setLogProject(p)} style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#3b82f6",fontWeight:600}}>
            💬{pComments} ✅{pTasks}
          </button>
        </div>

        {canEdit&&<div style={{marginTop:6}}>
          <input type="range" min="0" max="100" value={p.progress} onChange={e=>update(p.id,{progress:+e.target.value})} style={{width:"100%",accentColor:stage.color}}/>
        </div>}
      </Card>;
    })}

    {/* Add/Edit modal */}
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
      <Lbl>Менеджер</Lbl>
      <Sel value={form.manager||""} onChange={v=>setForm(p=>({...p,manager:v}))} options={[{v:"",l:"— Оберіть —"},{v:"Власник",l:"Власник"},{v:"Менеджер",l:"Менеджер"}]}/>
      <Lbl>Нотатки</Lbl><Input value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Деталі..."/>
      <Lbl>⚠️ Проблема</Lbl><Input value={form.issues} onChange={v=>setForm(p=>({...p,issues:v}))} placeholder="Порожньо = все ок"/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}

    {/* Members modal */}
    {membersModal&&<Modal title={`Виконавці: ${membersModal.name}`} onClose={()=>setMembersModal(null)}>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:12}}>Оберіть хто працює на цьому проєкті</div>
      {brigadeMembers.map(m=>{
        const isOnProject=projectMembers.some(pm=>pm.project_id===membersModal.id&&pm.member_id===m.id);
        return <div key={m.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f1f5f9"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{SPEC_EMOJI[m.specialization]||"👷"}</span>
            <div>
              <div style={{fontWeight:600,fontSize:13}}>{m.name}</div>
              <div style={{fontSize:10,color:"#94a3b8"}}>{m.specialization}</div>
            </div>
          </div>
          <button onClick={async()=>{
            if(isOnProject){
              const pm=projectMembers.find(pm=>pm.project_id===membersModal.id&&pm.member_id===m.id);
              if(pm)await removeMember(pm.id);
            } else {
              await addMember({project_id:membersModal.id,member_id:m.id,role_on_project:"worker"});
            }
          }} style={{padding:"5px 12px",border:"none",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:600,background:isOnProject?"#fef2f2":"#f0fdf4",color:isOnProject?"#ef4444":"#10b981"}}>
            {isOnProject?"Видалити":"Призначити"}
          </button>
        </div>;
      })}
      <Btn onClick={()=>setMembersModal(null)} full outline color="#94a3b8" style={{marginTop:14}}>Готово</Btn>
    </Modal>}

    {/* Log modal */}
    {logProject&&<Modal title={logProject.name} onClose={()=>setLogProject(null)}>
      <ProjectLog project={logProject} commentsH={commentsH} tasksH={tasksH} user={user}/>
    </Modal>}
  </div>;
}
// ─── CRM CALCULATOR ───────────────────────────────────────────────────────────
function CRMCalculator({client,bomData,materialsData,sizesData,onSave}){
  const [open,setOpen]=useState(false);
  const [cfg,setCfg]=useState({
    sizeId:"",customW:0,customL:0,modules:1,
    hasTerrace:false,terraceW:2.5,terraceL:6,
    facade:"planken",kit:"turnkey",
    hasElectric:true,hasWater:true,hasSewage:true,
    hasHeatedFloor:false,hasKitchen:false,
    labourScheme:"fixed",labourFixed:150000,
    margin:30,
  });
  const [kpSent,setKpSent]=useState(false);

  const popularSizes=sizesData.filter(s=>s.is_popular&&s.status==="active");
  const selSize=sizesData.find(s=>s.id===cfg.sizeId);
  const W=selSize?.name==="Індивідуальний"?+cfg.customW:(selSize?+selSize.width:0);
  const L=selSize?.name==="Індивідуальний"?+cfg.customL:(selSize?+selSize.length:0);
  const floorArea=W*L*cfg.modules;
  const extWallArea=(2*(W+L*cfg.modules))*2.55;
  const roofArea=floorArea;

  // Спрощений розрахунок матеріалів
  function calcMat(){
    if(!W||!L) return 0;
    const vata=(floorArea*2+extWallArea*1.5+roofArea*2)*250;
    const para=Math.ceil((floorArea+extWallArea+roofArea)/75)*1500;
    const pvh=roofArea*1.15*350;
    const wood=floorArea*0.06*15000;
    const osb=Math.ceil(floorArea/3.125)*850+Math.ceil(roofArea/3.125)*520;
    const facades={planken:550,termo:2000,imitacia:420,siding:380};
    const fasad=extWallArea*1.15*(facades[cfg.facade]||550)+5000;
    const windows=cfg.modules*3.5*4500+7000+(cfg.modules>1?2:1)*11000;
    const comm=(cfg.hasElectric?20000:0)+(cfg.hasWater?20000:0)+(cfg.hasSewage?20000:0);
    const finish=floorArea*450+extWallArea*0.8*185+(cfg.hasKitchen?35000:0)+(cfg.hasHeatedFloor?floorArea*650:0);
    return Math.round(vata+para+pvh+wood+osb+fasad+windows+comm+finish);
  }

  const matCost=calcMat();
  const labCost=cfg.labourScheme==="fixed"?+cfg.labourFixed:Math.round(floorArea*900+extWallArea*700+roofArea*900);
  const overhead=Math.round((matCost+labCost)*0.06);
  const cost=matCost+labCost+overhead;
  const price=Math.round(cost*(1+cfg.margin/100));
  const marginAmt=price-cost;

  const FACADES=[{v:"planken",l:"Планкен сосна"},{v:"termo",l:"Термодерево"},{v:"imitacia",l:"Імітація бруса"},{v:"siding",l:"Сайдинг"}];

  if(!open) return <Card style={{background:"linear-gradient(135deg,#10b981,#059669)",marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
      <div>
        <div style={{fontWeight:700,fontSize:13,color:"#fff"}}>⚡ КП Калькулятор</div>
        <div style={{fontSize:11,color:"#d1fae5",marginTop:2}}>Порахуйте ціну прямо тут</div>
      </div>
      <Btn onClick={()=>setOpen(true)} color="#fff" style={{color:"#059669",fontWeight:700}}>Відкрити →</Btn>
    </div>
  </Card>;

  return <Card style={{borderLeft:"3px solid #10b981",marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
      <div style={{fontWeight:700,fontSize:13}}>⚡ КП для {client.name}</div>
      <button onClick={()=>setOpen(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:"#94a3b8"}}>✕</button>
    </div>

    {/* Розмір */}
    <Lbl>Розмір модуля</Lbl>
    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
      {popularSizes.map(s=><button key={s.id} onClick={()=>setCfg(p=>({...p,sizeId:s.id}))}
        style={{padding:"5px 10px",borderRadius:8,border:`2px solid ${cfg.sizeId===s.id?"#10b981":"#e2e8f0"}`,background:cfg.sizeId===s.id?"#f0fdf4":"#fff",cursor:"pointer",fontSize:11,fontWeight:cfg.sizeId===s.id?700:400,color:cfg.sizeId===s.id?"#10b981":"#475569"}}>
        {s.name}
      </button>)}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
      <div>
        <Lbl>Модулів</Lbl>
        <div style={{display:"flex",gap:4}}>
          {[1,2,3].map(n=><button key={n} onClick={()=>setCfg(p=>({...p,modules:n}))}
            style={{flex:1,padding:"6px",border:`2px solid ${cfg.modules===n?"#10b981":"#e2e8f0"}`,borderRadius:8,background:cfg.modules===n?"#f0fdf4":"#fff",cursor:"pointer",fontSize:12,fontWeight:cfg.modules===n?700:400,color:cfg.modules===n?"#10b981":"#475569"}}>
            {n}
          </button>)}
        </div>
      </div>
      <div>
        <Lbl>Маржа: {cfg.margin}%</Lbl>
        <input type="range" min="15" max="55" value={cfg.margin} onChange={e=>setCfg(p=>({...p,margin:+e.target.value}))} style={{width:"100%",accentColor:"#10b981",marginTop:6}}/>
      </div>
    </div>

    {/* Фасад */}
    <Lbl>Фасад</Lbl>
    <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>
      {FACADES.map(f=><button key={f.v} onClick={()=>setCfg(p=>({...p,facade:f.v}))}
        style={{fontSize:10,padding:"4px 8px",borderRadius:8,border:`2px solid ${cfg.facade===f.v?"#10b981":"#e2e8f0"}`,background:cfg.facade===f.v?"#f0fdf4":"#fff",cursor:"pointer",fontWeight:cfg.facade===f.v?700:400,color:cfg.facade===f.v?"#10b981":"#475569"}}>
        {f.l}
      </button>)}
    </div>

    {/* Опції */}
    <Lbl>Опції</Lbl>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8}}>
      {[{k:"hasElectric",l:"⚡ Електрика"},{k:"hasWater",l:"🚿 Вода"},{k:"hasSewage",l:"🔧 Каналізація"},{k:"hasKitchen",l:"🍳 Кухня"},{k:"hasHeatedFloor",l:"🌡 Тепла підлога"}].map(({k,l})=>(
        <button key={k} onClick={()=>setCfg(p=>({...p,[k]:!p[k]}))}
          style={{padding:"5px 8px",border:`2px solid ${cfg[k]?"#10b981":"#e2e8f0"}`,borderRadius:8,background:cfg[k]?"#f0fdf4":"#fff",cursor:"pointer",fontSize:10,fontWeight:cfg[k]?700:400,color:cfg[k]?"#10b981":"#475569",textAlign:"left"}}>
          {cfg[k]?"✓ ":""}{l}
        </button>
      ))}
    </div>

    {/* Оплата бригади */}
    <Lbl>Оплата бригади</Lbl>
    <div style={{display:"flex",gap:5,marginBottom:W>0?10:0}}>
      {[{v:"fixed",l:"Фіксована"},{v:"perSqm",l:"По м²"}].map(s=>(
        <button key={s.v} onClick={()=>setCfg(p=>({...p,labourScheme:s.v}))}
          style={{flex:1,padding:"5px",border:"none",borderRadius:8,cursor:"pointer",fontSize:10,fontWeight:cfg.labourScheme===s.v?700:400,background:cfg.labourScheme===s.v?"#1e293b":"#e2e8f0",color:cfg.labourScheme===s.v?"#fff":"#64748b"}}>
          {s.l}
        </button>
      ))}
    </div>
    {cfg.labourScheme==="fixed"&&<Sel value={cfg.labourFixed} onChange={v=>setCfg(p=>({...p,labourFixed:+v}))} options={[125000,150000,175000].map(v=>({v,l:`₴${fmt(v)}`}))} style={{marginBottom:8}}/>}

    {/* РЕЗУЛЬТАТ */}
    {W>0&&L>0&&<>
      <div style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",borderRadius:12,padding:"12px 14px",marginTop:8,marginBottom:10}}>
        <div style={{fontSize:10,color:"#475569",marginBottom:8}}>{W}×{L*cfg.modules}м · {(W*L*cfg.modules).toFixed(0)}м²</div>
        {[
          {l:"Матеріали",  v:matCost,  c:"#f59e0b"},
          {l:"Праця",      v:labCost,  c:"#06b6d4"},
          {l:"Собівартість",v:cost,    c:"#e2e8f0",bold:true},
          {l:`Ціна (${cfg.margin}%)`,v:price,c:"#10b981",big:true},
          {l:"Маржа ₴",   v:marginAmt,c:"#22c55e"},
        ].map((x,i)=><div key={i} style={{display:"flex",justifyContent:"space-between",padding:"4px 0",borderBottom:i<4?"1px solid #ffffff10":"none"}}>
          <span style={{fontSize:x.bold||x.big?11:10,color:x.bold||x.big?"#cbd5e1":"#94a3b8"}}>{x.l}</span>
          <span style={{fontSize:x.big?18:x.bold?13:11,fontWeight:x.big?900:x.bold?700:500,color:x.c}}>₴{fmt(x.v)}</span>
        </div>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        <Btn onClick={async()=>{await onSave(price);setKpSent(true);setTimeout(()=>setKpSent(false),2000);}} color="#10b981" full>
          {kpSent?"✅ Збережено!":"💾 Зберегти в угоду"}
        </Btn>
        <Btn onClick={()=>{
          const win=window.open("","_blank");
win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>КП — ${client.name}</title><style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b}h1{font-size:22px;margin-bottom:4px}.sub{color:#64748b;font-size:13px;margin-bottom:24px}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#f8fafc;padding:10px;text-align:left;border-bottom:2px solid #e2e8f0;font-size:12px}td{padding:10px;border-bottom:1px solid #f9fafb;font-size:13px}.price{font-weight:900;color:#10b981;font-size:28px;text-align:center;padding:20px}.footer{color:#94a3b8;font-size:11px;margin-top:40px;border-top:1px solid #e2e8f0;padding-top:16px}</style></head><body> <h1>🏗️ МОДУЛЕР ПРО — Комерційна пропозиція</h1> <div class="sub">Клієнт: ${client.name} · ${client.phone} · ${new Date().toLocaleDateString("uk-UA")}</div> <h3>Об'єкт: каркасний будинок ${W}×${L*cfg.modules}м (${(W*L*cfg.modules).toFixed(0)}м²)</h3> <table><tr><th>Складова</th><th>Сума (₴)</th></tr> <tr><td>Матеріали (оптові ціни)</td><td>₴${fmt(matCost)}</td></tr> <tr><td>Праця (${cfg.labourScheme==="fixed"?"фіксована":"по м²"})</td><td>₴${fmt(labCost)}</td></tr> <tr><td>Накладні</td><td>₴${fmt(overhead)}</td></tr> <tr><td><b>Собівартість</b></td><td><b>₴${fmt(cost)}</b></td></tr></table> <div class="price">Ціна: ₴${fmt(price)}</div> <h3>Схема оплат</h3> <p>🔸 10% — бронювання/договір: ₴${fmt(Math.round(price*0.1))}<br> 🔸 40% — старт виробництва: ₴${fmt(Math.round(price*0.4))}<br> 🔸 30% — готовність коробки: ₴${fmt(Math.round(price*0.3))}<br> 🔸 20% — здача під ключ: ₴${fmt(Math.round(price*0.2))}</p> <p><b>Склад:</b> ${FACADES.find(f=>f.v===cfg.facade)?.l||cfg.facade} · ${cfg.hasElectric?"Електрика":""}${cfg.hasWater?" · Водопровід":""}${cfg.hasSewage?" · Каналізація":""}${cfg.hasKitchen?" · Кухня":""}${cfg.hasHeatedFloor?" · Тепла підлога":""}</p> <div class="footer">МОДУЛЕР ПРО · КП дійсне 14 днів · ${new Date().toLocaleDateString("uk-UA")}</div> </body></html>`);
          win.document.close();win.print();
        }} color="#6366f1" full>📄 Друк КП</Btn>
      </div>
    </>}

    {(!W||!L)&&<div style={{textAlign:"center",color:"#94a3b8",padding:12,fontSize:12}}>Оберіть розмір модуля щоб побачити ціну</div>}
  </Card>;
}

// ─── CRM ──────────────────────────────────────────────────────────────────────
const CONTACT_TYPES={
  call:     {l:"📞 Дзвінок",   c:"#3b82f6"},
  meeting:  {l:"🤝 Зустріч",   c:"#8b5cf6"},
  email:    {l:"📧 Email",     c:"#06b6d4"},
  whatsapp: {l:"💬 WhatsApp",  c:"#10b981"},
  viber:    {l:"📱 Viber",     c:"#7c3aed"},
  other:    {l:"📝 Інше",      c:"#94a3b8"},
};

function CRM({hook,contactsH,configH}){
  const {data:clients,loading,saving,create,update,remove}=hook;
  const {data:contacts,create:addContact,remove:removeContact}=contactsH||{data:[],create:async()=>{},remove:async()=>{}};
  const {productsH}=configH||{};

  const [tab,setTab]=useState("pipeline");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [selectedClient,setSelectedClient]=useState(null);
  const [contactForm,setContactForm]=useState({type:"call",summary:"",next_action:"",next_action_date:"",author:"Менеджер"});
  const [search,setSearch]=useState("");
  const [filterStage,setFilterStage]=useState("all");

  const today_=new Date().toISOString().slice(0,10);
  const pipeline=clients.filter(c=>!["won","lost"].includes(c.stage));
  const pVal=pipeline.reduce((s,c)=>s+(+c.deal_amount||+c.budget||0),0);
  const wonVal=clients.filter(c=>c.stage==="won").reduce((s,c)=>s+(+c.deal_amount||+c.budget||0),0);
  const overdueContacts=clients.filter(c=>c.next_contact_date&&c.next_contact_date<today_&&!["won","lost"].includes(c.stage));

  const empty={name:"",phone:"",email:"",stage:"new",budget:0,deal_amount:0,source:"Instagram",notes:"",assigned_to:"Менеджер",next_contact_date:""};

  const filteredClients=clients.filter(c=>{
    const ms=filterStage==="all"||c.stage===filterStage;
    const mq=!search||c.name?.toLowerCase().includes(search.toLowerCase())||c.phone?.includes(search);
    return ms&&mq;
  });

  function getClientContacts(clientId){
    return [...(contacts||[])].filter(c=>c.client_id===clientId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  }

  if(loading)return <Spin/>;

  // ── ДЕТАЛЬНА КАРТКА КЛІЄНТА ──
  if(selectedClient){
    const client=clients.find(c=>c.id===selectedClient)||selectedClient;
    const cContacts=getClientContacts(client.id);
    const stage=CRM_STAGES.find(s=>s.id===client.stage)||CRM_STAGES[0];
    return <div>
      <button onClick={()=>setSelectedClient(null)} style={{background:"none",border:"none",color:"#3b82f6",cursor:"pointer",fontSize:13,marginBottom:12,fontWeight:600}}>← Назад до списку</button>

      {/* Картка клієнта */}
      <Card style={{borderLeft:`3px solid ${stage.color}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:800,fontSize:16}}>{client.name}</div>
            <div style={{fontSize:12,color:"#64748b",marginTop:2}}>{client.phone}{client.email&&` · ${client.email}`}</div>
          </div>
          <button onClick={()=>{setForm({...client});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:12}}>✏️</button>
        </div>

        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
          <Badge color={stage.color}>{stage.label}</Badge>
          {client.source&&<Badge color="#06b6d4">📲 {client.source}</Badge>}
          {client.assigned_to&&<Badge color="#8b5cf6">👔 {client.assigned_to}</Badge>}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
            <div style={{fontSize:9,color:"#94a3b8"}}>Бюджет клієнта</div>
            <div style={{fontSize:14,fontWeight:700,color:"#8b5cf6"}}>₴{fmt(+client.budget||0)}</div>
          </div>
          <div style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}>
            <div style={{fontSize:9,color:"#94a3b8"}}>Сума угоди</div>
            <div style={{fontSize:14,fontWeight:700,color:"#10b981"}}>₴{fmt(+client.deal_amount||0)}</div>
          </div>
        </div>

        {client.next_contact_date&&<div style={{background:client.next_contact_date<today_?"#fef2f2":"#f0fdf4",borderRadius:8,padding:"6px 10px",marginBottom:8,fontSize:11}}>
          {client.next_contact_date<today_?"⚠️ Прострочено: ":"📅 Наступний контакт: "}
          <strong>{fmtDate(client.next_contact_date)}</strong>
        </div>}

        {client.notes&&<div style={{fontSize:12,color:"#64748b",marginBottom:8}}>💬 {client.notes}</div>}

        {/* Зміна статусу */}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {CRM_STAGES.map(s=><button key={s.id} onClick={()=>update(client.id,{stage:s.id})}
            style={{fontSize:9,padding:"3px 8px",borderRadius:99,border:"none",cursor:"pointer",fontWeight:client.stage===s.id?700:400,background:client.stage===s.id?s.color:"#f1f5f9",color:client.stage===s.id?"#fff":"#64748b"}}>
            {s.label}
          </button>)}
        </div>
      </Card>

      {/* КП Калькулятор */}
      <CRMCalculator client={client} bomData={configH?.bomData||[]} materialsData={configH?.materialsData||[]} sizesData={configH?.sizesData||[]} onSave={async(price)=>{await update(client.id,{deal_amount:price});}}/>

      {/* Додати контакт */}
      <Card style={{background:"#f8fafc"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>+ Новий контакт</div>
        <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
          {Object.entries(CONTACT_TYPES).map(([k,v])=><button key={k} onClick={()=>setContactForm(p=>({...p,type:k}))}
            style={{fontSize:10,padding:"4px 10px",borderRadius:20,border:`2px solid ${contactForm.type===k?v.c:"#e2e8f0"}`,background:contactForm.type===k?v.c+"15":"#fff",cursor:"pointer",fontWeight:contactForm.type===k?700:400,color:contactForm.type===k?v.c:"#475569"}}>
            {v.l}
          </button>)}
        </div>
        <Input value={contactForm.summary} onChange={v=>setContactForm(p=>({...p,summary:v}))} placeholder="Що обговорили..."/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}>
          <Input value={contactForm.next_action} onChange={v=>setContactForm(p=>({...p,next_action:v}))} placeholder="Наступна дія..."/>
          <Input type="date" value={contactForm.next_action_date} onChange={v=>setContactForm(p=>({...p,next_action_date:v}))}/>
        </div>
        <Btn onClick={async()=>{
          if(!contactForm.summary.trim())return;
          await addContact({...contactForm,client_id:client.id});
          if(contactForm.next_action_date){
            await update(client.id,{next_contact_date:contactForm.next_action_date,last_contact_at:new Date().toISOString()});
          }
          setContactForm({type:"call",summary:"",next_action:"",next_action_date:"",author:"Менеджер"});
        }} full style={{marginTop:8}}>💾 Зберегти контакт</Btn>
      </Card>

      {/* Історія контактів */}
      <div style={{fontWeight:700,fontSize:11,color:"#64748b",letterSpacing:"0.08em",marginBottom:8}}>ІСТОРІЯ ({cContacts.length})</div>
      {cContacts.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:16,fontSize:13}}>Контактів ще немає</div>}
      {cContacts.map(c=>{
        const t=CONTACT_TYPES[c.type]||CONTACT_TYPES.other;
        return <div key={c.id} style={{background:"#fff",borderRadius:12,padding:"10px 14px",marginBottom:8,borderLeft:`3px solid ${t.c}`,boxShadow:"0 1px 6px #00000008"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
            <span style={{fontWeight:700,fontSize:12,color:t.c}}>{t.l}</span>
            <span style={{fontSize:10,color:"#94a3b8"}}>{fmtDate(c.created_at)}</span>
          </div>
          <div style={{fontSize:13,color:"#1e293b",marginBottom:c.next_action?6:0}}>{c.summary}</div>
          {c.next_action&&<div style={{fontSize:11,color:"#f59e0b",background:"#fffbeb",borderRadius:6,padding:"3px 8px"}}>
            → {c.next_action}{c.next_action_date&&` · ${fmtDate(c.next_action_date)}`}
          </div>}
          {c.author&&<div style={{fontSize:10,color:"#94a3b8",marginTop:4}}>👔 {c.author}</div>}
        </div>;
      })}
    </div>;
  }

  return <div>
    {/* Нагадування */}
    {overdueContacts.length>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626",fontWeight:600}}>
      📞 {overdueContacts.length} клієнт(ів) потребують контакту! {overdueContacts.map(c=>c.name).join(", ")}
    </div>}

    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["pipeline","🎯 Воронка"],["list","📋 Список"],["stats","📊 Статистика"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── ВОРОНКА ── */}
    {tab==="pipeline"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:14}}>
        {[
          {l:"В роботі",   v:pipeline.length,                    c:"#6366f1", sub:"лідів"},
          {l:"Pipeline",   v:"₴"+fmt(pVal),                      c:"#8b5cf6", sub:"потенціал"},
          {l:"Закрито",    v:"₴"+fmt(wonVal),                    c:"#10b981", sub:"угод"},
        ].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:10,padding:"8px 10px",textAlign:"center"}}>
          <div style={{fontSize:13,fontWeight:800,color:x.c}}>{x.v}</div>
          <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
        </div>)}
      </div>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Пошук..." style={{flex:1}}/>
        <Btn onClick={()=>{setForm({...empty});setModal("add");}} small color="#6366f1">+</Btn>
      </div>

      {CRM_STAGES.filter(s=>clients.some(c=>c.stage===s.id)).map(stage=>{
        const sc=filteredClients.filter(c=>c.stage===stage.id);
        if(!sc.length)return null;
        const stageVal=sc.reduce((s,c)=>s+(+c.deal_amount||+c.budget||0),0);
        return <div key={stage.id} style={{marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"6px 12px",background:stage.color+"15",borderRadius:10,borderLeft:`3px solid ${stage.color}`}}>
            <span style={{fontWeight:700,color:stage.color,fontSize:13}}>{stage.label}</span>
            {stageVal>0&&<span style={{fontSize:11,color:stage.color}}>₴{fmt(stageVal)}</span>}
            <span style={{marginLeft:"auto",background:stage.color,color:"#fff",borderRadius:99,width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700}}>{sc.length}</span>
          </div>
          {sc.map(c=>{
            const cContacts=getClientContacts(c.id);
            const lastContact=cContacts[0];
            const isOverdue=c.next_contact_date&&c.next_contact_date<today_;
            return <Card key={c.id} style={{margin:"0 0 8px",borderLeft:isOverdue?"3px solid #ef4444":"none",cursor:"pointer"}} onClick={()=>setSelectedClient(c.id)}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
                  <div style={{fontSize:11,color:"#64748b"}}>{c.phone}</div>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:8}}>
                  {(+c.deal_amount||+c.budget)>0&&<Badge color="#8b5cf6">₴{fmt(+c.deal_amount||+c.budget)}</Badge>}
                  {c.source&&<Badge color="#06b6d4">{c.source}</Badge>}
                </div>
              </div>

              {isOverdue&&<div style={{fontSize:10,color:"#ef4444",marginBottom:4}}>⚠️ Прострочено контакт: {fmtDate(c.next_contact_date)}</div>}
              {!isOverdue&&c.next_contact_date&&<div style={{fontSize:10,color:"#10b981",marginBottom:4}}>📅 Контакт: {fmtDate(c.next_contact_date)}</div>}

              {lastContact&&<div style={{fontSize:11,color:"#94a3b8",background:"#f8fafc",borderRadius:6,padding:"3px 8px",marginBottom:4}}>
                {CONTACT_TYPES[lastContact.type]?.l} · {lastContact.summary?.slice(0,50)}...
              </div>}

              <div style={{fontSize:10,color:"#3b82f6",fontWeight:600}}>Тап → детальніше ({cContacts.length} контактів) →</div>
            </Card>;
          })}
        </div>;
      })}
    </>}

    {/* ── СПИСОК ── */}
    {tab==="list"&&<>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Пошук..." style={{flex:1}}/>
        <Btn onClick={()=>{setForm({...empty});setModal("add");}} small color="#6366f1">+</Btn>
      </div>
      <div style={{display:"flex",gap:5,overflowX:"auto",marginBottom:12,paddingBottom:4}}>
        <button onClick={()=>setFilterStage("all")} style={{flexShrink:0,fontSize:10,padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filterStage==="all"?"#1e293b":"#e2e8f0",color:filterStage==="all"?"#fff":"#475569"}}>Всі</button>
        {CRM_STAGES.map(s=><button key={s.id} onClick={()=>setFilterStage(s.id)} style={{flexShrink:0,fontSize:10,padding:"3px 10px",borderRadius:20,border:"none",cursor:"pointer",fontWeight:600,background:filterStage===s.id?s.color:"#e2e8f0",color:filterStage===s.id?"#fff":"#475569"}}>{s.label}</button>)}
      </div>
      {filteredClients.map(c=>{
        const stage=CRM_STAGES.find(s=>s.id===c.stage)||CRM_STAGES[0];
        const cContacts=getClientContacts(c.id);
        return <Card key={c.id} style={{margin:"0 0 8px",cursor:"pointer"}} onClick={()=>setSelectedClient(c.id)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:13}}>{c.name}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{c.phone}</div>
            </div>
            <div style={{display:"flex",gap:5,alignItems:"center"}}>
              <Badge color={stage.color}>{stage.label}</Badge>
              <span style={{fontSize:11,color:"#94a3b8"}}>{cContacts.length}📞</span>
            </div>
          </div>
        </Card>;
      })}
    </>}

    {/* ── СТАТИСТИКА ── */}
    {tab==="stats"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {l:"Нові ліди",      v:clients.filter(c=>c.stage==="new").length,      c:"#6366f1"},
          {l:"Угод закрито",   v:clients.filter(c=>c.stage==="won").length,      c:"#10b981"},
          {l:"Відмовили",      v:clients.filter(c=>c.stage==="lost").length,     c:"#ef4444"},
          {l:"Конверсія",      v:clients.length>0?Math.round(clients.filter(c=>c.stage==="won").length/clients.length*100)+"%":"—", c:"#f59e0b"},
        ].map((x,i)=><Card key={i} style={{margin:0}}><div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div><div style={{fontSize:18,fontWeight:800,color:x.c}}>{x.v}</div></Card>)}
      </div>

      <Card>
        <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>📲 Джерела лідів</div>
        {[...new Set(clients.map(c=>c.source).filter(Boolean))].map(src=>{
          const cnt=clients.filter(c=>c.source===src).length;
          const won=clients.filter(c=>c.source===src&&c.stage==="won").length;
          const pct=Math.round(cnt/clients.length*100);
          return <div key={src} style={{marginBottom:8}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{fontWeight:600}}>{src}</span>
              <span style={{color:"#64748b"}}>{cnt} лідів · {won} угод</span>
            </div>
            <PBar value={pct} color="#6366f1" height={5}/>
          </div>;
        })}
      </Card>

      <Card>
        <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>🏆 Воронка конверсії</div>
        {CRM_STAGES.map(s=>{
          const cnt=clients.filter(c=>c.stage===s.id).length;
          const pct=clients.length>0?Math.round(cnt/clients.length*100):0;
          return <div key={s.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:80,fontSize:10,color:"#475569",flexShrink:0}}>{s.label}</div>
            <div style={{flex:1,background:"#f1f5f9",borderRadius:99,height:16,overflow:"hidden"}}>
              <div style={{width:pct+"%",height:"100%",background:s.color,borderRadius:99,display:"flex",alignItems:"center",justifyContent:"flex-end",paddingRight:4}}>
                {pct>10&&<span style={{fontSize:9,color:"#fff",fontWeight:700}}>{cnt}</span>}
              </div>
            </div>
            <div style={{width:28,textAlign:"right",fontSize:10,color:"#94a3b8",flexShrink:0}}>{pct}%</div>
          </div>;
        })}
      </Card>
    </>}

    {/* Add/Edit modal */}
    {modal&&form&&<Modal title={modal==="add"?"Новий клієнт":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Ім'я</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Ім'я Прізвище"/>
      <Lbl>Телефон</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+380..."/>
      <Lbl>Email</Lbl><Input value={form.email} onChange={v=>setForm(p=>({...p,email:v}))} placeholder="email@example.com"/>
      <Lbl>Статус</Lbl><Sel value={form.stage} onChange={v=>setForm(p=>({...p,stage:v}))} options={CRM_STAGES.map(s=>({v:s.id,l:s.label}))}/>
      <Lbl>Бюджет клієнта (₴)</Lbl><Input type="number" value={form.budget} onChange={v=>setForm(p=>({...p,budget:+v}))}/>
      <Lbl>Сума угоди (₴)</Lbl><Input type="number" value={form.deal_amount||0} onChange={v=>setForm(p=>({...p,deal_amount:+v}))}/>
      <Lbl>Відповідальний</Lbl><Sel value={form.assigned_to||"Менеджер"} onChange={v=>setForm(p=>({...p,assigned_to:v}))} options={["Власник","Менеджер"].map(v=>({v,l:v}))}/>
      <Lbl>Джерело</Lbl><Sel value={form.source||"Instagram"} onChange={v=>setForm(p=>({...p,source:v}))} options={["Instagram","Facebook","Google","Referral","Viber","Telegram","Сайт","Виставка","Інше"].map(v=>({v,l:v}))}/>
      <Lbl>Наступний контакт</Lbl><Input type="date" value={form.next_contact_date||""} onChange={v=>setForm(p=>({...p,next_contact_date:v}))}/>
      <Lbl>Нотатки</Lbl><Input value={form.notes} onChange={v=>setForm(p=>({...p,notes:v}))} placeholder="Деталі..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#6366f1" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── OVERHEAD COSTS MODULE ────────────────────────────────────────────────────
const CAT_COLORS=["#6366f1","#3b82f6","#f59e0b","#10b981","#06b6d4","#8b5cf6","#ef4444","#f97316"];

function OverheadCosts({overheadH,catsH,projects}){
  const {data:overhead,loading,create,update,remove}=overheadH;
  const {data:cats,create:createCat,update:updateCat}=catsH||{data:[],create:async()=>{},update:async()=>{}};
  const [tab,setTab]=useState("month");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [catModal,setCatModal]=useState(false);
  const [newCat,setNewCat]=useState({name:"",icon:"💼"});
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7));

  const activeCats=cats.filter(c=>c.status!=="archived").sort((a,b)=>a.sort_order-b.sort_order);
  const monthData=overhead.filter(o=>o.month&&o.month.startsWith(month)&&o.status!=="archived");
  const totalMonth=monthData.reduce((s,o)=>s+ +o.amount,0);
  const activeProjects=projects.filter(p=>!["paid","lead"].includes(p.stage));
  const perProject=activeProjects.length>0?Math.round(totalMonth/activeProjects.length):0;

  function catColor(name){ const i=activeCats.findIndex(c=>c.name===name); return CAT_COLORS[i%CAT_COLORS.length]||"#94a3b8"; }
  function catIcon(name){ return activeCats.find(c=>c.name===name)?.icon||"💼"; }

  if(loading)return <Spin/>;

  return <div>
    {/* Tabs */}
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["month","💰 Місяць"],["projects","📊 Проєкти"],["cats","⚙️ Статті"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── МІСЯЦЬ ── */}
    {tab==="month"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          style={{padding:"7px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none"}}/>
        <Btn onClick={()=>{setForm({month:month+"-01",category:activeCats[0]?.name||"",amount:0,note:""});setModal("add");}} small>+ Витрата</Btn>
      </div>

      {/* Підсумок */}
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:8}}>ОФІСНІ ВИТРАТИ · {month}</div>
        <div style={{fontSize:26,fontWeight:900,color:"#ef4444",marginBottom:4}}>₴{fmt(totalMonth)}</div>
        <div style={{fontSize:11,color:"#94a3b8"}}>на місяць · {activeCats.length} статей</div>
      </Card>

      {/* По категоріях */}
      {activeCats.map(cat=>{
        const item=monthData.find(o=>o.category===cat.name);
        const amt=item?+item.amount:0;
        const pct=totalMonth>0?Math.round(amt/totalMonth*100):0;
        const c=catColor(cat.name);
        return <Card key={cat.id} style={{padding:"10px 14px",margin:"0 0 8px",borderLeft:`3px solid ${c}`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:amt>0?6:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>{cat.icon}</span>
              <div>
                <div style={{fontSize:13,fontWeight:600}}>{cat.name}</div>
                {item?.note&&<div style={{fontSize:10,color:"#94a3b8"}}>{item.note}</div>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{fontWeight:800,fontSize:14,color:amt>0?"#ef4444":"#94a3b8"}}>
                {amt>0?`₴${fmt(amt)}`:"—"}
              </div>
              <button onClick={()=>{
                if(item){setForm({...item});setModal("edit");}
                else{setForm({month:month+"-01",category:cat.name,amount:0,note:""});setModal("add");}
              }} style={{background:"#f1f5f9",border:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:11}}>
                {item?"✏️":"+ Додати"}
              </button>
            </div>
          </div>
          {amt>0&&<PBar value={pct} color={c} height={4}/>}
        </Card>;
      })}

      {/* Підсумок */}
      {totalMonth>0&&<Card style={{borderTop:"2px solid #e2e8f0",marginTop:4}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontWeight:700,fontSize:14}}>Разом за місяць</span>
          <span style={{fontWeight:900,fontSize:18,color:"#ef4444"}}>₴{fmt(totalMonth)}</span>
        </div>
      </Card>}
    </>}

    {/* ── ПРОЄКТИ ── */}
    {tab==="projects"&&<>
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:8}}>РОЗПОДІЛ НА ПРОЄКТИ · {month}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <div><div style={{fontSize:9,color:"#64748b"}}>Всього витрат</div><div style={{fontSize:18,fontWeight:800,color:"#ef4444"}}>₴{fmt(totalMonth)}</div></div>
          <div><div style={{fontSize:9,color:"#64748b"}}>На проєкт</div><div style={{fontSize:18,fontWeight:800,color:"#f59e0b"}}>₴{fmt(perProject)}</div></div>
        </div>
        <div style={{fontSize:10,color:"#475569",marginTop:8}}>÷ {activeProjects.length} активних проєктів (рівномірно)</div>
      </Card>

      {activeProjects.map(p=>{
        const rawM=+p.sale_price-+p.spent;
        const realM=rawM-perProject;
        const rawPct=+p.sale_price>0?Math.round(rawM/+p.sale_price*100):0;
        const realPct=+p.sale_price>0?Math.round(realM/+p.sale_price*100):0;
        const c=realPct>=25?"#10b981":realPct>=15?"#f59e0b":"#ef4444";
        return <Card key={p.id} style={{margin:"0 0 8px"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>{p.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
            {[
              {l:"Без накл.",v:`${rawPct}%`,c:"#64748b"},
              {l:"Накладні",v:`-₴${fmt(perProject)}`,c:"#ef4444"},
              {l:"Реальна",v:`${realPct}%`,c},
            ].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
              <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
              <div style={{fontSize:13,fontWeight:800,color:x.c}}>{x.v}</div>
            </div>)}
          </div>
          <PBar value={realPct} color={c} height={5}/>
        </Card>;
      })}

      {activeProjects.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:20,fontSize:13}}>Немає активних проєктів</div>}
    </>}

    {/* ── СТАТТІ ── */}
    {tab==="cats"&&<>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div style={{fontSize:12,color:"#64748b"}}>{activeCats.length} активних статей</div>
        <Btn onClick={()=>setCatModal(true)} small color="#6366f1">+ Нова стаття</Btn>
      </div>

      {activeCats.map((cat,i)=><Card key={cat.id} style={{padding:"10px 14px",margin:"0 0 8px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>{cat.icon}</span>
          <div>
            <div style={{fontSize:13,fontWeight:600}}>{cat.name}</div>
            <div style={{fontSize:10,color:"#94a3b8"}}>Активна</div>
          </div>
        </div>
        <button onClick={()=>updateCat(cat.id,{status:"archived"})}
          style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#ef4444",fontWeight:600}}>
          Архів
        </button>
      </Card>)}

      {/* Архівовані */}
      {cats.filter(c=>c.status==="archived").length>0&&<>
        <div style={{fontSize:10,color:"#94a3b8",letterSpacing:"0.08em",margin:"12px 0 8px"}}>АРХІВОВАНІ</div>
        {cats.filter(c=>c.status==="archived").map(cat=><Card key={cat.id} style={{padding:"10px 14px",margin:"0 0 6px",opacity:0.6,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:20}}>{cat.icon}</span>
            <div style={{fontSize:12,color:"#94a3b8"}}>{cat.name}</div>
          </div>
          <button onClick={()=>updateCat(cat.id,{status:"active"})}
            style={{background:"#f0fdf4",border:"none",borderRadius:8,padding:"4px 10px",cursor:"pointer",fontSize:11,color:"#10b981",fontWeight:600}}>
            Відновити
          </button>
        </Card>)}
      </>}
    </>}

    {/* Modal — витрата */}
    {modal&&form&&<Modal title={modal==="add"?"Нова витрата":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Стаття витрат</Lbl>
      <Sel value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={activeCats.map(c=>({v:c.name,l:`${c.icon} ${c.name}`}))}/>
      <Lbl>Сума (₴)</Lbl>
      <Input type="number" value={form.amount} onChange={v=>setForm(p=>({...p,amount:+v}))} placeholder="0"/>
      <Lbl>Місяць</Lbl>
      <input type="month" value={form.month?.slice(0,7)||month} onChange={e=>setForm(p=>({...p,month:e.target.value+"-01"}))}
        style={{width:"100%",padding:"9px 12px",borderRadius:10,border:"1.5px solid #e2e8f0",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
      <Lbl>Нотатка</Lbl>
      <Input value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Деталі..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#ef4444" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}

    {/* Modal — нова категорія */}
    {catModal&&<Modal title="Нова стаття витрат" onClose={()=>setCatModal(false)}>
      <Lbl>Іконка</Lbl>
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:8}}>
        {["🏢","👔","📢","🚗","☕","💡","📱","🖥️","✈️","🎯","💼","🔧","📦","🏗️","💰","📋"].map(ico=>(
          <button key={ico} onClick={()=>setNewCat(p=>({...p,icon:ico}))}
            style={{width:38,height:38,fontSize:20,border:`2px solid ${newCat.icon===ico?"#6366f1":"#e2e8f0"}`,borderRadius:10,background:newCat.icon===ico?"#ede9fe":"#f8fafc",cursor:"pointer"}}>
            {ico}
          </button>
        ))}
      </div>
      <Lbl>Назва статті</Lbl>
      <Input value={newCat.name} onChange={v=>setNewCat(p=>({...p,name:v}))} placeholder="Наприклад: Юридичні послуги"/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setCatModal(false)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{
          if(!newCat.name.trim())return;
          await createCat({name:newCat.name,icon:newCat.icon,status:"active",sort_order:activeCats.length+1});
          setNewCat({name:"",icon:"💼"});setCatModal(false);
        }} color="#6366f1" style={{flex:2}}>💾 Додати статтю</Btn>
      </div>
    </Modal>}
  </div>;
}

// ─── ANALYTICS ────────────────────────────────────────────────────────────────
function MiniChart({data,color="#3b82f6",height=60}){
  if(!data||data.length<2)return null;
  const max=Math.max(...data);
  const min=Math.min(...data);
  const range=max-min||1;
  const w=300,h=height;
  const pts=data.map((v,i)=>`${i/(data.length-1)*w},${h-(v-min)/range*(h-8)-4}`).join(" ");
  return <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height,display:"block"}}>
    <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    {data.map((v,i)=>{ const x=i/(data.length-1)*w; const y=h-(v-min)/range*(h-8)-4; return <circle key={i} cx={x} cy={y} r="3" fill={color}/>; })}
  </svg>;
}

function Analytics({projects,workers,operations,materials,bom,overhead,statsH}){
  const {data:stats=[],loading:sLoad=false}=statsH||{};
  const [tab,setTab]=useState("overview");
  const tSale =projects.reduce((s,p)=>s+ +p.sale_price,0);
  const tSpent=projects.reduce((s,p)=>s+ +p.spent,0);
  const curMonth=new Date().toISOString().slice(0,7);
  const monthOverhead=overhead.filter(o=>o.month?.startsWith(curMonth));
  const totalOverhead=monthOverhead.reduce((s,o)=>s+ +o.amount,0);
  const activeProjects=projects.filter(p=>!["paid","lead"].includes(p.stage));
  const overheadPerUnit=activeProjects.length>0?Math.round(totalOverhead/activeProjects.length):0;
  const margin=tSale-tSpent;
  const realMargin=tSale-tSpent-totalOverhead;
  const mPct=tSale>0?Math.round(margin/tSale*100):0;
  const realMPct=tSale>0?Math.round(realMargin/tSale*100):0;
  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const matOpt=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);
  const matRetail=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.retail_price*i.qty:0);},0);

  const sortedStats=[...stats].sort((a,b)=>new Date(a.month)-new Date(b.month));
  const months=sortedStats.map(s=>new Date(s.month).toLocaleDateString("uk-UA",{month:"short"}));
  const revenueData=sortedStats.map(s=>+s.revenue/1000);
  const marginData=sortedStats.map(s=>(+s.revenue-+s.costs)/1000);
  const marginPctData=sortedStats.map(s=>+s.revenue>0?Math.round((+s.revenue-+s.costs)/+s.revenue*100):0);

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["overview","📊 Огляд"],["monthly","📈 Місяці"],["overhead","🏢 Накладні"],["structure","🔍 Структура"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 12px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:11,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {tab==="overview"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {l:"Загальна виручка", v:"₴"+fmt(tSale),c:"#3b82f6"},
          {l:"Загальні витрати", v:"₴"+fmt(tSpent),c:"#e11d48"},
          {l:`Маржа (${mPct}%)`, v:"₴"+fmt(margin),c:mPct>=25?"#10b981":"#f59e0b"},
          {l:`Реальна (${realMPct}%)`,v:"₴"+fmt(realMargin),c:realMPct>=20?"#10b981":"#ef4444"},
        ].map((x,i)=><Card key={i} style={{margin:0}}><div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div><div style={{fontSize:14,fontWeight:800,color:x.c}}>{x.v}</div></Card>)}
      </div>
      {totalOverhead>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626"}}>
        ⚠️ Офісні витрати ₴{fmt(totalOverhead)}/міс знижують маржу на {mPct-realMPct}%
      </div>}
      <Card>
        <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>📊 Маржа по проєктах</div>
        {projects.filter(p=>p.stage!=="paid").map(p=>{
          const m=+p.sale_price-+p.spent;
          const realM=m-overheadPerUnit;
          const pct=+p.sale_price>0?Math.round(m/+p.sale_price*100):0;
          const realPct=+p.sale_price>0?Math.round(realM/+p.sale_price*100):0;
          return <div key={p.id} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%",fontWeight:600}}>{p.name}</span>
              <span><span style={{color:"#94a3b8",fontSize:10}}>{pct}%→</span><span style={{fontWeight:800,color:realPct>=20?"#10b981":realPct>=10?"#f59e0b":"#ef4444"}}>{realPct}%</span></span>
            </div>
            <PBar value={realPct} color={realPct>=20?"#10b981":realPct>=10?"#f59e0b":"#ef4444"} height={6}/>
          </div>;
        })}
      </Card>
    </>}

    {tab==="monthly"&&<>
      {sLoad?<Spin/>:<>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:12}}>💰 Виручка (тис. ₴)</div>
            <div style={{fontWeight:800,fontSize:14,color:"#3b82f6"}}>{revenueData[revenueData.length-1]?.toFixed(0)}к</div>
          </div>
          <MiniChart data={revenueData} color="#3b82f6"/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            {months.map((m,i)=><span key={i} style={{fontSize:9,color:"#94a3b8"}}>{m}</span>)}
          </div>
        </Card>

        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{fontWeight:700,fontSize:12}}>📈 Маржа (%)</div>
            <div style={{fontWeight:800,fontSize:14,color:marginPctData[marginPctData.length-1]>=25?"#10b981":"#f59e0b"}}>
              {marginPctData[marginPctData.length-1]}%
            </div>
          </div>
          <MiniChart data={marginPctData} color="#10b981"/>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
            {months.map((m,i)=><span key={i} style={{fontSize:9,color:"#94a3b8"}}>{m}</span>)}
          </div>
        </Card>

        <Card>
          <div style={{fontWeight:700,fontSize:12,marginBottom:10}}>📋 Деталі по місяцях</div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
              <thead>
                <tr style={{borderBottom:"2px solid #e2e8f0"}}>
                  {["Місяць","Виручка","Витрати","Маржа","%"].map(h=><th key={h} style={{padding:"4px 6px",textAlign:"right",color:"#94a3b8",fontWeight:600,whiteSpace:"nowrap",fontSize:10}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((s,i)=>{
                  const m=+s.revenue-+s.costs;
                  const pct=+s.revenue>0?Math.round(m/+s.revenue*100):0;
                  const isLast=i===sortedStats.length-1;
                  return <tr key={s.id||i} style={{borderBottom:"1px solid #f1f5f9",background:isLast?"#f8fafc":"transparent",fontWeight:isLast?700:400}}>
                    <td style={{padding:"6px",color:"#475569",whiteSpace:"nowrap",fontSize:11}}>{new Date(s.month).toLocaleDateString("uk-UA",{month:"short",year:"2-digit"})}</td>
                    <td style={{padding:"6px",textAlign:"right",color:"#3b82f6",fontSize:11}}>₴{fmt(+s.revenue/1000)}к</td>
                    <td style={{padding:"6px",textAlign:"right",color:"#e11d48",fontSize:11}}>₴{fmt(+s.costs/1000)}к</td>
                    <td style={{padding:"6px",textAlign:"right",color:pct>=25?"#10b981":"#f59e0b",fontSize:11}}>₴{fmt(m/1000)}к</td>
                    <td style={{padding:"6px",textAlign:"right",fontWeight:700,color:pct>=25?"#10b981":pct>=15?"#f59e0b":"#ef4444",fontSize:11}}>{pct}%</td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {sortedStats.length>=2&&<Card style={{borderLeft:"3px solid #3b82f6"}}>
          <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>📊 Тренд (vs попередній місяць)</div>
          {(()=>{
            const prev=sortedStats[sortedStats.length-2];
            const curr=sortedStats[sortedStats.length-1];
            const revGrow=+prev.revenue>0?Math.round((+curr.revenue/+prev.revenue-1)*100):0;
            const mPrev=+prev.revenue-+prev.costs;
            const mCurr=+curr.revenue-+curr.costs;
            const margGrow=mPrev>0?Math.round((mCurr/mPrev-1)*100):0;
            return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[{l:"Виручка",v:revGrow},{l:"Маржа ₴",v:margGrow}].map((x,i)=>(
                <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div>
                  <div style={{fontSize:18,fontWeight:800,color:x.v>=0?"#10b981":"#ef4444"}}>{x.v>=0?"↑":"↓"}{Math.abs(x.v)}%</div>
                </div>
              ))}
            </div>;
          })()}
        </Card>}
      </>}
    </>}

    {tab==="overhead"&&<>
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff",marginBottom:14}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:8}}>ОФІСНІ ВИТРАТИ · поточний місяць</div>
        <div style={{fontSize:24,fontWeight:900,color:"#ef4444"}}>₴{fmt(totalOverhead)}</div>
        <div style={{fontSize:11,color:"#94a3b8",marginTop:4}}>÷ {activeProjects.length} проєктів = ₴{fmt(overheadPerUnit)}/проєкт</div>
      </Card>
      {activeProjects.map(p=>{
        const rawM=+p.sale_price-+p.spent;
        const realM=rawM-overheadPerUnit;
        const rawPct=+p.sale_price>0?Math.round(rawM/+p.sale_price*100):0;
        const realPct=+p.sale_price>0?Math.round(realM/+p.sale_price*100):0;
        return <Card key={p.id} style={{margin:"0 0 8px"}}>
          <div style={{fontWeight:700,fontSize:12,marginBottom:6,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>
            {[{l:"Без накл.",v:`${rawPct}%`,c:"#64748b"},{l:"Накладні",v:`-₴${fmt(overheadPerUnit)}`,c:"#ef4444"},{l:"Реальна",v:`${realPct}%`,c:realPct>=20?"#10b981":"#ef4444"}].map((x,i)=>(
              <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"5px 8px",textAlign:"center"}}>
                <div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div>
                <div style={{fontSize:12,fontWeight:800,color:x.c}}>{x.v}</div>
              </div>
            ))}
          </div>
        </Card>;
      })}
    </>}

    {tab==="structure"&&<>
      <Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
        <div style={{fontSize:11,color:"#475569",marginBottom:14}}>СТРУКТУРА СОБІВАРТОСТІ</div>
        {[{l:"🪵 Матеріали (опт)",v:matOpt,c:"#f59e0b"},{l:"👷 Оплата праці",v:laborCost,c:"#06b6d4"},{l:"🏢 Офісні витрати/міс",v:totalOverhead,c:"#ef4444"}].map((x,i)=>{
          const total=matOpt+laborCost+totalOverhead;
          const pct=total>0?Math.round(x.v/total*100):0;
          return <div key={i} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#94a3b8"}}>{x.l}</span><span style={{fontWeight:700,color:x.c}}>₴{fmt(x.v)} ({pct}%)</span></div><div style={{background:"#ffffff15",borderRadius:99,height:8}}><div style={{width:pct+"%",height:"100%",background:x.c,borderRadius:99}}/></div></div>;
        })}
      </Card>
      <Card style={{borderLeft:"3px solid #10b981"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>💡 Оптові закупки</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Роздріб",v:"₴"+fmt(matRetail),c:"#e11d48"},{l:"Опт",v:"₴"+fmt(matOpt),c:"#10b981"},{l:"Економія",v:"₴"+fmt(matRetail-matOpt),c:"#f59e0b"}].map((x,i)=>(
            <div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}><div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div><div style={{fontSize:12,fontWeight:700,color:x.c}}>{x.v}</div></div>
          ))}
        </div>
      </Card>
    </>}
  </div>;
}

  // Офісні витрати за поточний місяць
  const curMonth=new Date().toISOString().slice(0,7);
  const monthOverhead=overhead.filter(o=>o.month&&o.month.startsWith(curMonth));
  const totalOverhead=monthOverhead.reduce((s,o)=>s+ +o.amount,0);
  const activeProjects=projects.filter(p=>p.stage!=="paid"&&p.stage!=="lead");
  const overheadPerProject=activeProjects.length>0?Math.round(totalOverhead/activeProjects.length):0;

  const margin=tSale-tSpent;
  const realMargin=tSale-tSpent-totalOverhead;
  const mPct  =tSale>0?Math.round(margin/tSale*100):0;
  const realMPct=tSale>0?Math.round(realMargin/tSale*100):0;
  const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);
  const matOpt=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.opt_price*i.qty:0);},0);
  const matRetail=bom.reduce((s,i)=>{const m=materials.find(x=>x.id===i.material_id);return s+(m?m.retail_price*i.qty:0);},0);

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
      {[["margin","Маржа"],["overhead","Накладні"],["structure","Структура"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flexShrink:0,padding:"7px 14px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:12,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {tab==="margin"&&<>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
        {[
          {l:"Загальна виручка",v:"₴"+fmt(tSale),c:"#3b82f6"},
          {l:"Загальні витрати",v:"₴"+fmt(tSpent),c:"#e11d48"},
          {l:`Маржа без накл (${mPct}%)`,v:"₴"+fmt(margin),c:mPct>=25?"#10b981":"#f59e0b"},
          {l:`Реальна маржа (${realMPct}%)`,v:"₴"+fmt(realMargin),c:realMPct>=20?"#10b981":realMPct>=10?"#f59e0b":"#ef4444"},
        ].map((x,i)=><Card key={i} style={{margin:0}}><div style={{fontSize:9,color:"#94a3b8",marginBottom:4}}>{x.l}</div><div style={{fontSize:14,fontWeight:800,color:x.c}}>{x.v}</div></Card>)}
      </div>

      {totalOverhead>0&&<div style={{background:"#fef2f2",border:"1px solid #fecaca",borderRadius:12,padding:"10px 14px",marginBottom:12,fontSize:12,color:"#dc2626"}}>
        ⚠️ Офісні витрати цього місяця: <strong>₴{fmt(totalOverhead)}</strong> зменшують маржу на <strong>{mPct-realMPct}%</strong>
      </div>}

      <Card>
        <div style={{fontWeight:700,fontSize:12,marginBottom:12}}>📊 Реальна маржа по проєктах</div>
        {projects.filter(p=>p.stage!=="paid").map(p=>{
          const m=+p.sale_price-+p.spent;
          const realM=m-overheadPerProject;
          const pct=+p.sale_price>0?Math.round(m/+p.sale_price*100):0;
          const realPct=+p.sale_price>0?Math.round(realM/+p.sale_price*100):0;
          return <div key={p.id} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:3}}>
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:"55%",fontWeight:600}}>{p.name}</span>
              <span>
                <span style={{color:"#94a3b8",fontSize:10}}>{pct}% → </span>
                <span style={{fontWeight:800,color:realPct>=20?"#10b981":realPct>=10?"#f59e0b":"#ef4444"}}>{realPct}%</span>
              </span>
            </div>
            <PBar value={realPct} color={realPct>=20?"#10b981":realPct>=10?"#f59e0b":"#ef4444"} height={6}/>
          </div>;
        })}
      </Card>

      <Card style={{borderLeft:"3px solid #10b981"}}>
        <div style={{fontWeight:700,fontSize:12,marginBottom:8}}>💡 Оптові закупки</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
          {[{l:"Роздріб",v:"₴"+fmt(matRetail),c:"#e11d48"},{l:"Опт",v:"₴"+fmt(matOpt),c:"#10b981"},{l:"Економія",v:"₴"+fmt(matRetail-matOpt),c:"#f59e0b"}].map((x,i)=><div key={i} style={{background:"#f8fafc",borderRadius:8,padding:"6px 10px"}}><div style={{fontSize:9,color:"#94a3b8"}}>{x.l}</div><div style={{fontSize:13,fontWeight:700,color:x.c}}>{x.v}</div></div>)}
        </div>
      </Card>
    </>}

    {tab==="overhead"&&<OverheadCosts overheadH={{data:overhead,loading:false,create:()=>{},update:()=>{},remove:()=>{}}} catsH={{data:[],create:async()=>{},update:async()=>{}}} projects={projects}/>}

    {tab==="structure"&&<Card style={{background:"linear-gradient(135deg,#0f172a,#1e293b)",color:"#fff"}}>
      <div style={{fontSize:11,color:"#475569",marginBottom:14}}>СТРУКТУРА СОБІВАРТОСТІ</div>
      {[
        {l:"🪵 Матеріали (опт)",  v:matOpt,        c:"#f59e0b"},
        {l:"👷 Оплата праці",     v:laborCost,     c:"#06b6d4"},
        {l:"🏢 Офісні витрати/міс",v:totalOverhead, c:"#ef4444"},
      ].map((x,i)=>{
        const total=matOpt+laborCost+totalOverhead;
        const pct=total>0?Math.round(x.v/total*100):0;
        return <div key={i} style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:4}}><span style={{color:"#94a3b8"}}>{x.l}</span><span style={{fontWeight:700,color:x.c}}>₴{fmt(x.v)} ({pct}%)</span></div>
          <div style={{background:"#ffffff15",borderRadius:99,height:8}}><div style={{width:pct+"%",height:"100%",background:x.c,borderRadius:99}}/></div>
        </div>;
      })}
    </Card>}
  </div>;
}

// ─── SUPPLIERS MODULE ─────────────────────────────────────────────────────────
function Suppliers({suppliersH,pricesH,materials}){
  const {data:suppliers,loading,create,update,remove}=suppliersH;
  const {data:prices,create:createPrice,update:updatePrice,remove:removePrice}=pricesH;
  const [tab,setTab]=useState("list");
  const [modal,setModal]=useState(null);
  const [form,setForm]=useState(null);
  const [selected,setSelected]=useState(null); // вибраний постачальник для деталей
  const [priceModal,setPriceModal]=useState(null);
  const [priceForm,setPriceForm]=useState(null);
  const [search,setSearch]=useState("");

  const CATS=["Деревина","Утеплення","Мембрани і скотчі","Плити OSB","Покрівля","Фасад","Електрика","Сантехніка","Будматеріали","Інше"];
  const PAY={cash:"Готівка",invoice:"Рахунок (ФОП)",card:"Картка"};

  const filtered=suppliers.filter(s=>s.status==="active"&&(!search||s.name.toLowerCase().includes(search.toLowerCase())||s.category?.toLowerCase().includes(search.toLowerCase())));

  const emptySupplier={name:"",category:CATS[0],phone:"",contact_person:"",payment_type:"cash",delivery_days:3,delivery_cost:0,min_order_uah:0,note:"",status:"active"};

  if(loading)return <Spin/>;

  // Знайти найкращу ціну по матеріалу
  function bestPrice(matId){
    const mPrices=prices.filter(p=>p.material_id===matId).sort((a,b)=>+a.price- +b.price);
    return mPrices[0];
  }

  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["list","📋 Список"],["compare","💡 Порівняння"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:12,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {/* ── СПИСОК ПОСТАЧАЛЬНИКІВ ── */}
    {tab==="list"&&<>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <Input value={search} onChange={setSearch} placeholder="🔍 Пошук..." style={{flex:1}}/>
        <Btn onClick={()=>{setForm({...emptySupplier});setModal("add");}} small>+</Btn>
      </div>

      {filtered.map(s=>{
        const sPrices=prices.filter(p=>p.supplier_id===s.id);
        return <Card key={s.id} style={{margin:"0 0 8px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1}}>
              <div style={{fontWeight:700,fontSize:14}}>{s.name}</div>
              <div style={{fontSize:11,color:"#64748b"}}>{s.category}</div>
            </div>
            <div style={{display:"flex",gap:5}}>
              <button onClick={()=>setSelected(selected?.id===s.id?null:s)}
                style={{background:"#f0f9ff",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11,color:"#3b82f6",fontWeight:600}}>
                {selected?.id===s.id?"▲":"▼"} {sPrices.length} цін
              </button>
              <button onClick={()=>{setForm({...s});setModal("edit");}} style={{background:"#f1f5f9",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>✏️</button>
              <button onClick={()=>confirm("Архівувати?")&&update(s.id,{status:"archived"})} style={{background:"#fef2f2",border:"none",borderRadius:8,padding:"4px 8px",cursor:"pointer",fontSize:11}}>🗑</button>
            </div>
          </div>

          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>
            {s.phone&&<Badge color="#6366f1">📞 {s.phone}</Badge>}
            {s.contact_person&&<Badge color="#8b5cf6">👤 {s.contact_person}</Badge>}
            <Badge color="#06b6d4">🚗 {s.delivery_days} дн.</Badge>
            {+s.delivery_cost>0&&<Badge color="#f59e0b">₴{fmt(+s.delivery_cost)} доставка</Badge>}
            <Badge color="#94a3b8">{PAY[s.payment_type]||s.payment_type}</Badge>
          </div>

          {s.note&&<div style={{fontSize:11,color:"#64748b",marginBottom:8}}>💬 {s.note}</div>}

          {/* Ціни цього постачальника */}
          {selected?.id===s.id&&<>
            <div style={{borderTop:"1px solid #f1f5f9",paddingTop:10,marginTop:4}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:"#64748b"}}>ПРАЙС</div>
                <Btn onClick={()=>{setPriceForm({supplier_id:s.id,material_id:"",price:0,min_qty:1,note:""});setPriceModal("add");}} small color="#10b981">+ Ціна</Btn>
              </div>
              {sPrices.length===0&&<div style={{fontSize:12,color:"#94a3b8",textAlign:"center",padding:10}}>Цін ще немає</div>}
              {sPrices.map(sp=>{
                const mat=materials.find(m=>m.id===sp.material_id);
                const best=mat?bestPrice(mat.id):null;
                const isBest=best?.id===sp.id;
                return <div key={sp.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 0",borderBottom:"1px solid #f9fafb"}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:600}}>{mat?.name||"—"}</div>
                    <div style={{fontSize:10,color:"#94a3b8"}}>від {sp.min_qty} {mat?.unit}</div>
                    {sp.note&&<div style={{fontSize:10,color:"#64748b"}}>{sp.note}</div>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                    {isBest&&<Badge color="#10b981">✅ Найдешевше</Badge>}
                    <div style={{fontWeight:700,fontSize:13,color:isBest?"#10b981":"#1e293b"}}>₴{fmt(+sp.price)}</div>
                    <button onClick={()=>removePrice(sp.id)} style={{background:"#fef2f2",border:"none",borderRadius:6,padding:"2px 6px",cursor:"pointer",fontSize:10}}>🗑</button>
                  </div>
                </div>;
              })}
            </div>
          </>}
        </Card>;
      })}

      {filtered.length===0&&<div style={{textAlign:"center",color:"#94a3b8",padding:30,fontSize:13}}>Постачальників не знайдено</div>}
    </>}

    {/* ── ПОРІВНЯННЯ ЦІН ── */}
    {tab==="compare"&&<>
      <div style={{fontSize:11,color:"#94a3b8",marginBottom:14}}>Матеріали де є кілька постачальників — бачите найкращу ціну</div>
      {materials.filter(m=>{
        const mPrices=prices.filter(p=>p.material_id===m.id);
        return mPrices.length>1;
      }).map(m=>{
        const mPrices=prices.filter(p=>p.material_id===m.id).sort((a,b)=>+a.price- +b.price);
        const best=mPrices[0];
        const worst=mPrices[mPrices.length-1];
        const saving=worst&&best?+worst.price- +best.price:0;
        return <Card key={m.id} style={{margin:"0 0 10px"}}>
          <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>{m.name}</div>
          {mPrices.map((sp,i)=>{
            const sup=suppliers.find(s=>s.id===sp.supplier_id);
            const isBest=i===0;
            return <div key={sp.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"5px 0",borderBottom:"1px solid #f9fafb"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                {isBest&&<span style={{fontSize:10}}>✅</span>}
                <div>
                  <div style={{fontSize:12,fontWeight:isBest?700:400}}>{sup?.name||"—"}</div>
                  <div style={{fontSize:10,color:"#94a3b8"}}>від {sp.min_qty} {m.unit} · {sup?.delivery_days}дн.</div>
                </div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:isBest?"#10b981":i===mPrices.length-1?"#ef4444":"#1e293b"}}>
                ₴{fmt(+sp.price)}/{m.unit}
              </div>
            </div>;
          })}
          {saving>0&&<div style={{marginTop:8,fontSize:11,color:"#10b981",fontWeight:600}}>
            💚 Економія від правильного вибору: ₴{fmt(saving)}/{m.unit}
          </div>}
        </Card>;
      })}
    </>}

    {/* Modal постачальник */}
    {modal&&form&&<Modal title={modal==="add"?"Новий постачальник":"Редагувати"} onClose={()=>setModal(null)}>
      <Lbl>Назва</Lbl><Input value={form.name} onChange={v=>setForm(p=>({...p,name:v}))} placeholder="Назва компанії"/>
      <Lbl>Категорія</Lbl><Sel value={form.category} onChange={v=>setForm(p=>({...p,category:v}))} options={CATS.map(v=>({v,l:v}))}/>
      <Lbl>Телефон</Lbl><Input value={form.phone} onChange={v=>setForm(p=>({...p,phone:v}))} placeholder="+380..."/>
      <Lbl>Контактна особа</Lbl><Input value={form.contact_person} onChange={v=>setForm(p=>({...p,contact_person:v}))} placeholder="Ім'я"/>
      <Lbl>Тип оплати</Lbl><Sel value={form.payment_type} onChange={v=>setForm(p=>({...p,payment_type:v}))} options={Object.entries(PAY).map(([v,l])=>({v,l}))}/>
      <Lbl>Термін доставки (днів)</Lbl><Input type="number" value={form.delivery_days} onChange={v=>setForm(p=>({...p,delivery_days:+v}))}/>
      <Lbl>Вартість доставки (₴)</Lbl><Input type="number" value={form.delivery_cost} onChange={v=>setForm(p=>({...p,delivery_cost:+v}))} placeholder="0 = безкоштовно"/>
      <Lbl>Нотатка</Lbl><Input value={form.note} onChange={v=>setForm(p=>({...p,note:v}))} placeholder="Умови, особливості..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ if(form.id)await update(form.id,form);else await create(form);setModal(null); }} color="#6366f1" style={{flex:2}}>💾 Зберегти</Btn>
      </div>
    </Modal>}

    {/* Modal ціна */}
    {priceModal&&priceForm&&<Modal title="Додати ціну" onClose={()=>setPriceModal(null)}>
      <Lbl>Матеріал</Lbl><Sel value={priceForm.material_id} onChange={v=>setPriceForm(p=>({...p,material_id:v}))} options={[{v:"",l:"— Оберіть матеріал —"},...materials.map(m=>({v:m.id,l:m.name}))]}/>
      <Lbl>Ціна (₴/{materials.find(m=>m.id===priceForm.material_id)?.unit||"од"})</Lbl>
      <Input type="number" value={priceForm.price} onChange={v=>setPriceForm(p=>({...p,price:+v}))} placeholder="0"/>
      <Lbl>Мін. замовлення</Lbl><Input type="number" value={priceForm.min_qty} onChange={v=>setPriceForm(p=>({...p,min_qty:+v}))} placeholder="1"/>
      <Lbl>Нотатка</Lbl><Input value={priceForm.note} onChange={v=>setPriceForm(p=>({...p,note:v}))} placeholder="Умови..."/>
      <div style={{display:"flex",gap:8,marginTop:14}}>
        <Btn onClick={()=>setPriceModal(null)} outline color="#94a3b8" style={{flex:1}}>Скасувати</Btn>
        <Btn onClick={async()=>{ await createPrice(priceForm);setPriceModal(null); }} color="#10b981" style={{flex:2}}>💾 Додати ціну</Btn>
      </div>
    </Modal>}
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

// ─── EXPORT MODULE ────────────────────────────────────────────────────────────
function ExportModule({projects,clients,materials,bom,workers,operations,overhead,stats}){
  const [selProject,setSelProject]=useState("");

  // ── Excel специфікація матеріалів ──
  function exportSpecExcel(project){
    const proj=projects.find(p=>p.id===project)||projects[0];
    if(!proj)return;
    const bomItems=bom.filter(b=>b.model===proj.bom_model||b.model==="3x6");
    const rows=[
      ["СПЕЦИФІКАЦІЯ МАТЕРІАЛІВ"],
      [`Проєкт: ${proj.name}`],
      [`Клієнт: ${proj.client}`],
      [`Дата: ${new Date().toLocaleDateString("uk-UA")}`],
      [],
      ["№","Категорія","Назва матеріалу","Од.","К-сть (BOM)","Ціна опт (₴)","Сума опт (₴)","Ціна роздріб (₴)","Постачальник","Нотатка"],
    ];
    let total=0;
    bomItems.forEach((item,i)=>{
      const mat=materials.find(m=>m.id===item.material_id);
      if(!mat)return;
      const sum=mat.opt_price*item.qty;
      total+=sum;
      rows.push([i+1,mat.category,mat.name,mat.unit,item.qty,mat.opt_price,sum,mat.retail_price,mat.supplier||"",item.note||""]);
    });
    rows.push([]);
    rows.push(["","","","","","РАЗОМ:",total,"","",""]);

    // Генеруємо CSV (відкривається в Excel)
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`Специфікація_${proj.name.replace(/\s+/g,"_")}_${today()}.csv`;
    a.click();
  }

  // ── PDF Акт здачі ──
  function exportAct(projectId){
    const proj=projects.find(p=>p.id===projectId)||projects[0];
    if(!proj)return;
    const win=window.open("","_blank");
win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Акт здачі — ${proj.name}</title> <style> body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1e293b;font-size:14px} h1{font-size:20px;text-align:center;margin-bottom:4px} .sub{text-align:center;color:#64748b;font-size:13px;margin-bottom:30px} table{width:100%;border-collapse:collapse;margin:16px 0} th,td{border:1px solid #e2e8f0;padding:8px 12px;text-align:left;font-size:13px} th{background:#f8fafc;font-weight:600} .sign-block{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px} .sign-line{border-bottom:1px solid #000;margin-top:40px;margin-bottom:4px} .total{font-size:18px;font-weight:900;color:#10b981} @media print{body{padding:20px}} </style></head><body> <h1>АКТ ЗДАЧІ-ПРИЙМАННЯ РОБІТ</h1> <div class="sub">МОДУЛЕР ПРО · ${new Date().toLocaleDateString("uk-UA")}</div>  <table> <tr><th>Об'єкт</th><td>${proj.name}</td></tr> <tr><th>Клієнт</th><td>${proj.client}</td></tr> <tr><th>Телефон</th><td>${proj.phone||"—"}</td></tr> <tr><th>Дата здачі</th><td>${new Date().toLocaleDateString("uk-UA")}</td></tr> <tr><th>Відповідальний</th><td>${proj.manager||"Менеджер"}</td></tr> </table>  <h3>Виконані роботи</h3> <table> <tr><th>№</th><th>Вид роботи</th><th>Обсяг</th><th>Статус</th></tr> <tr><td>1</td><td>Каркас будинку</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>2</td><td>Утеплення (вата + мембрани)</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>3</td><td>Покрівля ПВХ мембрана</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>4</td><td>Зовнішнє оздоблення (фасад)</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>5</td><td>Внутрішнє оздоблення</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>6</td><td>Електрика</td><td>Повністю</td><td>✅ Виконано</td></tr> <tr><td>7</td><td>Сантехніка</td><td>Повністю</td><td>✅ Виконано</td></tr> </table>  <h3>Фінанси</h3> <table> <tr><th>Вартість за договором</th><td class="total">₴${fmt(+proj.sale_price)}</td></tr> <tr><th>Отримано авансів</th><td>₴${fmt(+proj.advance)}</td></tr> <tr><th>До сплати залишок</th><td style="font-weight:700;color:#ef4444">₴${fmt(+proj.sale_price- +proj.advance)}</td></tr> </table>  <p style="margin-top:16px">Роботи виконані в повному обсязі відповідно до договору. Претензій до якості виконаних робіт не маю.</p>  <div class="sign-block"> <div> <p><strong>ВИКОНАВЕЦЬ</strong></p> <p>МОДУЛЕР ПРО</p> <div class="sign-line"></div> <p style="font-size:12px;color:#64748b">підпис / дата</p> </div> <div> <p><strong>ЗАМОВНИК</strong></p> <p>${proj.client}</p> <div class="sign-line"></div> <p style="font-size:12px;color:#64748b">підпис / дата</p> </div> </div> </body></html>`);
    win.document.close();
    win.print();
  }

  // ── PDF Місячний звіт ──
  function exportMonthReport(){
    const month=new Date().toLocaleDateString("uk-UA",{month:"long",year:"numeric"});
    const active=projects.filter(p=>!["paid"].includes(p.stage));
    const tSale=projects.reduce((s,p)=>s+ +p.sale_price,0);
    const tSpent=projects.reduce((s,p)=>s+ +p.spent,0);
    const tAdv=projects.reduce((s,p)=>s+ +p.advance,0);
    const totalOverhead=overhead.reduce((s,o)=>s+ +o.amount,0);
    const laborCost=operations.reduce((s,o)=>{const w=workers.find(x=>x.id===o.worker_id);return s+(w?w.rate*o.hours*o.qty:0);},0);

    const win=window.open("","_blank");
win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Звіт ${month}</title> <style> body{font-family:Arial,sans-serif;max-width:820px;margin:0 auto;padding:40px;color:#1e293b} h1{font-size:22px;margin-bottom:4px} .sub{color:#64748b;font-size:13px;margin-bottom:24px} table{width:100%;border-collapse:collapse;margin:16px 0} th,td{border:1px solid #e2e8f0;padding:8px 12px;font-size:13px} th{background:#f8fafc;font-weight:600;text-align:left} .big{font-size:20px;font-weight:900} .green{color:#10b981} .red{color:#ef4444} .blue{color:#3b82f6} @media print{body{padding:20px}} </style></head><body> <h1>📊 МІСЯЧНИЙ ЗВІТ</h1> <div class="sub">МОДУЛЕР ПРО · ${month} · Сформовано ${new Date().toLocaleDateString("uk-UA")}</div>  <h3>Фінансові показники</h3> <table> <tr><th>Загальна виручка (всі проєкти)</th><td class="big blue">₴${fmt(tSale)}</td></tr> <tr><th>Загальні витрати</th><td class="big red">₴${fmt(tSpent)}</td></tr> <tr><th>Маржа</th><td class="big green">₴${fmt(tSale-tSpent)} (${tSale>0?Math.round((tSale-tSpent)/tSale*100):0}%)</td></tr> <tr><th>Аванси отримано</th><td>₴${fmt(tAdv)}</td></tr> <tr><th>До отримання</th><td>₴${fmt(tSale-tAdv)}</td></tr> <tr><th>Офісні витрати місяця</th><td class="red">₴${fmt(totalOverhead)}</td></tr> <tr><th>Реальна маржа (з накладними)</th><td class="big ${tSale-tSpent-totalOverhead>0?"green":"red"}">₴${fmt(tSale-tSpent-totalOverhead)}</td></tr> </table>  <h3>Активні проєкти (${active.length})</h3> <table> <tr><th>Проєкт</th><th>Клієнт</th><th>Статус</th><th>Прогрес</th><th>Ціна</th><th>Маржа</th></tr> ${active.map(p=>{ const m=+p.sale_price-+p.spent; const pct=+p.sale_price>0?Math.round(m/+p.sale_price*100):0; const stage=STAGES.find(s=>s.id===p.stage)||STAGES[0]; return `<tr> <td>${p.name}</td><td>${p.client}</td> <td>${stage.emoji} ${stage.label}</td> <td>${p.progress}%</td> <td>₴${fmt(+p.sale_price)}</td> <td style="color:${pct>=25?"#10b981":"#ef4444"}">₴${fmt(m)} (${pct}%)</td> </tr>`; }).join("")} </table>  <h3>Офісні витрати</h3> <table> <tr><th>Стаття</th><th>Сума</th></tr> ${overhead.map(o=>`<tr><td>${o.category}</td><td>₴${fmt(+o.amount)}</td></tr>`).join("")} <tr><th>РАЗОМ</th><th>₴${fmt(totalOverhead)}</th></tr> </table> </body></html>`);
    win.document.close();
    win.print();
  }

  // ── Excel клієнтська база ──
  function exportClientsCSV(){
    const rows=[
      ["Ім'я","Телефон","Email","Статус","Бюджет","Джерело","Відповідальний","Нотатки"],
      ...clients.map(c=>[c.name,c.phone,c.email,c.stage,c.budget,c.source,c.assigned_to,c.notes])
    ];
    const csv=rows.map(r=>r.map(c=>`"${String(c||"").replace(/"/g,'""')}"`).join(";")).join("\n");
    const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`Клієнти_${today()}.csv`;
    a.click();
  }

  return <div>
    <div style={{fontSize:12,color:"#64748b",marginBottom:14}}>Генерація документів і звітів</div>

    {/* Акт здачі */}
    <Card style={{borderLeft:"3px solid #10b981"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>✅ Акт здачі-приймання</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>PDF з підписами замовника і виконавця</div>
      <Lbl>Оберіть проєкт</Lbl>
      <Sel value={selProject} onChange={setSelProject} options={[{v:"",l:"— Оберіть проєкт —"},...projects.map(p=>({v:p.id,l:p.name}))]}/>
      <Btn onClick={()=>selProject&&exportAct(selProject)} color="#10b981" full style={{marginTop:8}} disabled={!selProject}>
        📄 Друк акту здачі
      </Btn>
    </Card>

    {/* Специфікація Excel */}
    <Card style={{borderLeft:"3px solid #3b82f6"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>📊 Специфікація матеріалів (Excel/CSV)</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Список всіх матеріалів з цінами для замовлення постачальнику</div>
      <Sel value={selProject} onChange={setSelProject} options={[{v:"",l:"— Оберіть проєкт —"},...projects.map(p=>({v:p.id,l:p.name}))]}/>
      <Btn onClick={()=>selProject&&exportSpecExcel(selProject)} color="#3b82f6" full style={{marginTop:8}} disabled={!selProject}>
        📥 Завантажити CSV (Excel)
      </Btn>
    </Card>

    {/* Місячний звіт */}
    <Card style={{borderLeft:"3px solid #8b5cf6"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>📈 Місячний звіт</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Фінанси, проєкти, маржа, офісні витрати</div>
      <Btn onClick={exportMonthReport} color="#8b5cf6" full>📄 Друк місячного звіту</Btn>
    </Card>

    {/* Клієнти CSV */}
    <Card style={{borderLeft:"3px solid #f59e0b"}}>
      <div style={{fontWeight:700,fontSize:13,marginBottom:6}}>👥 Клієнтська база (Excel/CSV)</div>
      <div style={{fontSize:11,color:"#64748b",marginBottom:10}}>Всі клієнти з контактами і статусами</div>
      <Btn onClick={exportClientsCSV} color="#f59e0b" full>📥 Завантажити CSV</Btn>
    </Card>
  </div>;
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function Settings({user,onLogout,projects,clients,materials,bom,workers,operations,overhead,stats}){
  const [tab,setTab]=useState("info");
  return <div>
    <div style={{display:"flex",gap:6,marginBottom:14}}>
      {[["info","⚙️ Система"],["export","📤 Експорт"]].map(([id,lbl])=>(
        <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"7px",border:"none",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:12,background:tab===id?"#1e293b":"#e2e8f0",color:tab===id?"#fff":"#64748b"}}>{lbl}</button>
      ))}
    </div>

    {tab==="export"&&<ExportModule projects={projects} clients={clients} materials={materials} bom={bom} workers={workers} operations={operations} overhead={overhead} stats={stats}/>}

    {tab==="info"&&<>
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
      <div style={{fontWeight:700,fontSize:13,marginBottom:8}}>📋 v7.9 — Що є в системі</div>
      {["✅ CRM з історією контактів","✅ Специфікація матеріалів по проєкту","✅ Технологічні чеклисти","✅ Документи і фото (Supabase Storage)","✅ Калькулятор в CRM","✅ Сповіщення (дедлайни, контакти)","✅ Контроль якості з фото","✅ Облік деревини і вогнезахист","✅ Пошук по всій системі","✅ Сортування проєктів","✅ Фінансовий прогноз","✅ Eksport PDF/Excel/CSV"].map((f,i)=><div key={i} style={{fontSize:12,color:"#475569",padding:"3px 0",borderBottom:"1px solid #f1f5f9"}}>{f}</div>)}
    </Card>
    <Btn onClick={onLogout} color="#ef4444" outline full>🚪 Вийти</Btn>
    </>}
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
  const overheadH  =useTable("overhead_costs");
  const catsH      =useTable("overhead_categories","order=sort_order.asc");
  const sizesH     =useTable("module_sizes","order=sort_order.asc");
  const suppliersH =useTable("suppliers","order=created_at.asc");
  const pricesH    =useTable("supplier_prices");
  const membersH   =useTable("project_members");
  const statsH     =useTable("monthly_stats","order=month.asc");
  const contactsH  =useTable("crm_contacts","order=created_at.desc");
  const checklistH =useTable("project_checklist","order=sort_order.asc");
  const docsH      =useTable("project_documents","order=created_at.desc");
  const notifsH    =useTable("notifications","order=created_at.desc");
  const lumberH    =useTable("lumber_log","order=date.desc");
  const commentsH  =useTable("project_comments","order=created_at.desc");
  const tasksH     =useTable("project_tasks","order=created_at.asc");

  const [user,setUser]    =useState(null);
  const [module,setModule]=useState("dashboard");

  // Need products table in Supabase — create if missing
  const [dbError,setDbError]=useState(null);
  useEffect(()=>{
    const errs=[workersH,materialsH,projectsH].map(h=>h.error).filter(Boolean);
    setDbError(errs[0]||null);
  },[workersH.error,materialsH.error,projectsH.error]);

  if(!user)return <Login onLogin={u=>{setUser(u);setModule("dashboard");}} teamMembers={teamH.data}/>;

  // ОКРЕМИЙ ІНТЕРФЕЙС ДЛЯ БРИГАДИ
  if(user.role==="brigade") return <BrigadeView
    member={user}
    projects={projectsH.data}
    tasks={tasksH.data}
    comments={commentsH.data}
    knowledge={knowledgeH.data}
    procurement={procH.data}
    materials={materialsH.data}
    tasksH={tasksH}
    commentsH={commentsH}
    teamH={teamH}
    projectMembers={membersH.data}
    onLogout={()=>setUser(null)}
  />;

  const role=ROLES[user.role];
  const visible=ALL_MODULES.filter(m=>role.access.includes(m.id));
  const active =visible.find(m=>m.id===module)||visible[0];
  const bottomModules=ALL_MODULES.filter(m=>BOTTOM_NAV.includes(m.id)&&role.access.includes(m.id));
  const overdue=projectsH.data.filter(p=>dLeft(p.deadline)<0&&p.stage!=="paid").length;
  const anySaving=[workersH,operationsH,materialsH,projectsH,clientsH,procH,knowledgeH,productsH,overheadH,catsH].some(h=>h.saving);

  function nav(id){
    if(id && role.access.includes(id)){
      setModule(id);
      window.scrollTo(0,0);
    }
  }

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
          <NotificationCenter notifsH={notifsH} onNav={nav}/>
          <div style={{background:"#1e293b",borderRadius:99,padding:"3px 8px",fontSize:10,color:anySaving?"#f59e0b":"#22c55e"}}>
            {anySaving?"⟳":"☁️"} {anySaving?"Sync":"Live"}
          </div>
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
      {module==="dashboard"    && <Dashboard   projects={projectsH.data} workers={workersH.data} operations={operationsH.data} procurement={procH.data} tasks={tasksH.data} projectsH={projectsH} commentsH={commentsH} tasksH={tasksH} user={user} clients={clientsH.data} materials={materialsH.data} knowledge={knowledgeH.data} onNav={nav}/>}
      {module==="configurator" && <Configurator sizesH={sizesH} materialsH={materialsH} workersH={workersH} operationsH={operationsH} productsH={productsH}/>}
      {module==="products"    && <Products    productsH={productsH} onNav={nav}/>}
      {module==="costing"     && <Costing     workersH={workersH} operationsH={operationsH} materialsH={materialsH} bomH={bomH} productsH={productsH} overheadH={overheadH} suppliersH={suppliersH} pricesH={pricesH} projectsH={projectsH}/>}
      {module==="procurement" && <Procurement procH={procH} materials={materialsH.data} projects={projectsH.data}/>}
      {module==="projects"    && <Projects    hook={projectsH} user={user} commentsH={commentsH} tasksH={tasksH} teamMembers={teamH.data} membersH={membersH} bomH={bomH} materialsH={materialsH} procH={procH} operationsH={operationsH} checklistH={checklistH} docsH={docsH} lumberH={lumberH}/>}
      {module==="crm"         && <CRM         hook={clientsH} contactsH={contactsH} configH={{productsH,bomData:bomH.data,materialsData:materialsH.data,sizesData:sizesH.data}}/>}
      {module==="analytics"   && <Analytics   projects={projectsH.data} workers={workersH.data} operations={operationsH.data} materials={materialsH.data} bom={bomH.data} overhead={overheadH.data} statsH={statsH}/>}
      {module==="finance"     && <OverheadCosts overheadH={overheadH} catsH={catsH} projects={projectsH.data}/>}
      {module==="suppliers"   && <Suppliers   suppliersH={suppliersH} pricesH={pricesH} materials={materialsH.data}/>}
      {module==="bom"         && <BOMModule   materialsH={materialsH} bomH={bomH} workersH={workersH} operationsH={operationsH}/>}
      {module==="team"        && <Team        hook={teamH} projects={projectsH.data}/>}
      {module==="knowledge"   && <Knowledge   hook={knowledgeH} user={user}/>}
      {module==="settings"    && <Settings    user={user} onLogout={()=>setUser(null)} projects={projectsH.data} clients={clientsH.data} materials={materialsH.data} bom={bomH.data} workers={workersH.data} operations={operationsH.data} overhead={overheadH.data} stats={statsH.data}/>}
    </div>

    {/* BOTTOM NAV — 6 основних модулів */}
    <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:"#0f172a",borderTop:"1px solid #1e293b",display:"flex"}}>
      {bottomModules.map(m=><button key={m.id} onClick={()=>setModule(m.id)} style={{flex:1,padding:"9px 2px 12px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:15,color:active.id===m.id?"#60a5fa":"#94a3b8"}}>{m.icon}</span>
        <span style={{fontSize:8,color:active.id===m.id?"#60a5fa":"#94a3b8",fontWeight:active.id===m.id?700:400}}>{m.label}</span>
      </button>)}
      <button onClick={()=>setModule("more")} style={{flex:1,padding:"9px 2px 12px",border:"none",background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
        <span style={{fontSize:15,color:module==="more"?"#60a5fa":"#94a3b8"}}>≡</span>
        <span style={{fontSize:8,color:module==="more"?"#60a5fa":"#94a3b8",fontWeight:module==="more"?700:400}}>Ще</span>
      </button>
    </div>
  </div>;
}
