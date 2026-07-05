import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import QRCode from'qrcode';
import'./styles.css';

const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasConfig=Boolean(supabaseUrl&&supabaseKey);
const supabase=hasConfig?createClient(supabaseUrl,supabaseKey):null;

const statusLabel={recebido_cliente:'Recebido do cliente',em_producao:'Em produção',pronto_entrega:'Pronto para entrega',entregue_cliente:'Entregue ao cliente'};
const statusBadge={recebido_cliente:'badge b1',em_producao:'badge b2',pronto_entrega:'badge b4',entregue_cliente:'badge b3'};
const dias=[['segunda','Segunda'],['terca','Terça'],['quarta','Quarta'],['quinta','Quinta'],['sexta','Sexta'],['sabado','Sábado'],['domingo','Domingo']];
const diaHoje=()=>['domingo','segunda','terca','quarta','quinta','sexta','sabado'][new Date().getDay()];
const diaLabel=v=>dias.find(d=>d[0]===v)?.[1]||'-';
function wazeUrl(c){return `https://waze.com/ul?q=${encodeURIComponent(c.address||c.name)}&navigate=yes`}
function phoneToWhatsapp(phone){const digits=String(phone||'').replace(/\D/g,'');const nine=digits.match(/9\d{8}/)?.[0];return nine?'351'+nine:''}
function whatsappUrl(phone,msg){const n=phoneToWhatsapp(phone);return n?`https://wa.me/${n}?text=${encodeURIComponent(msg)}`:''}

function Login({onLogin}){
 const[code,setCode]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
 async function submit(){setError('');const{data,error}=await supabase.rpc('login_user',{p_code:code,p_password:password});if(error){setError(error.message);return}if(!data?.length){setError('Código ou senha incorretos.');return}onLogin(data[0])}
 return <div className="login-shell"><div className="login-card"><div className="brand"><div className="logo">V&A</div><h1>Vincos & Agulha</h1><p>Gestão operacional</p></div><label>Código</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><label>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={submit}>Entrar</button><p className="muted">Gerente inicial: GER001 / 123456</p>{error&&<div className="warning">{error}</div>}</div></div>
}
function MissingConfig(){return <div className="login-shell"><div className="login-card"><h2>Configuração em falta</h2><div className="error">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.</div></div></div>}

function App(){
 const[user,setUser]=useState(null),[tab,setTab]=useState('dashboard'),[clients,setClients]=useState([]),[orders,setOrders]=useState([]),[events,setEvents]=useState([]),[users,setUsers]=useState([]),[commLogs,setCommLogs]=useState([]);
 async function load(){
   const[c,o,e,u,l]=await Promise.all([
     supabase.from('clients').select('*').order('client_number'),
     supabase.from('orders').select('*').order('created_at',{ascending:false}),
     supabase.from('order_events').select('*').order('created_at',{ascending:false}).limit(100),
     supabase.from('app_users').select('id,name,access_code,role,active,client_id,last_login_at,created_at,must_change_password').order('created_at',{ascending:false}),
     supabase.from('communication_logs').select('*').order('created_at',{ascending:false}).limit(20)
   ]);
   setClients(c.data||[]);setOrders(o.data||[]);setEvents(e.data||[]);setUsers(u.data||[]);setCommLogs(l.data||[]);
 }
 useEffect(()=>{if(user)load()},[user]);
 if(!hasConfig)return <MissingConfig/>;
 if(!user)return <Login onLogin={setUser}/>;
 const manager=user.role==='gerente', staff=user.role==='funcionario'||manager, driver=user.role==='motorista', client=user.role==='cliente';
 const nav=[
  manager&&['dashboard','🏠 Dashboard'],
  manager&&['clientes','👥 Clientes'],
  staff&&['producao','📦 Produção'],
  (manager||driver)&&['motoristas','🚚 Motoristas'],
  manager&&['comunicacao','💬 Comunicação'],
  manager&&['relatorios','📈 Relatórios'],
  client&&['cliente','👤 Área do Cliente'],
  manager&&['historico','🕓 Histórico'],
  manager&&['admin','⚙ Administração']
 ].filter(Boolean);
 return <div className="app"><aside className="sidebar"><div className="logo">V&A</div><h2>Vincos & Agulha</h2><p>V1.2 — Operação Real</p><div className="nav">{nav.map(n=><button key={n[0]} className={tab===n[0]?'active':''} onClick={()=>setTab(n[0])}>{n[1]}</button>)}</div></aside><section className="main"><div className="topbar"><div><h1>{nav.find(n=>n[0]===tab)?.[1]||'Vincos & Agulha'}</h1><div className="userbox">Sessão: <b>{user.name}</b> | Perfil: <b>{user.role}</b></div></div><button className="logout" onClick={()=>setUser(null)}>Sair</button></div><div className="content">
 {tab==='dashboard'&&manager&&<Dashboard clients={clients} orders={orders}/>}
 {tab==='clientes'&&manager&&<Clients clients={clients} orders={orders}/>}
 {tab==='producao'&&staff&&<Production user={user} clients={clients} orders={orders} load={load}/>}
 {tab==='motoristas'&&(manager||driver)&&<Drivers user={user} clients={clients} orders={orders} load={load}/>}
 {tab==='comunicacao'&&manager&&<Communication user={user} clients={clients} logs={commLogs} load={load}/>}
 {tab==='relatorios'&&manager&&<Reports clients={clients} orders={orders}/>}
 {tab==='cliente'&&client&&<ClientPortal user={user} orders={orders}/>}
 {tab==='historico'&&manager&&<History orders={orders} events={events}/>}
 {tab==='admin'&&manager&&<Admin currentUser={user} users={users} clients={clients} load={load}/>}
 </div></section></div>
}

function Stat({title,value}){return <div className="card"><div className="stat-title">{title}</div><div className="stat">{value}</div></div>}

function Dashboard({clients,orders}){
 const today=new Date().toISOString().slice(0,10), day=diaHoje();
 const todayOrders=orders.filter(o=>o.created_at?.slice(0,10)===today);
 const todayClients=clients.filter(c=>c.active&&(c.pickup_day===day||c.delivery_day===day));
 return <><div className="section-title"><h2>Centro de Operações</h2><span className="badge">{new Date().toLocaleDateString('pt-PT')}</span></div><div className="grid"><Stat title="Clientes previstos hoje" value={todayClients.length}/><Stat title="Encomendas hoje" value={todayOrders.length}/><Stat title="Peças hoje" value={todayOrders.reduce((s,o)=>s+Number(o.pieces||0),0)}/><Stat title="Em produção" value={orders.filter(o=>o.status==='em_producao').length}/><Stat title="Prontas" value={orders.filter(o=>o.status==='pronto_entrega').length}/><Stat title="Entregues" value={orders.filter(o=>o.status==='entregue_cliente').length}/></div><div className="card"><h3>Últimas encomendas</h3><OrdersTable orders={orders.slice(0,10)} manager/></div></>
}

function Clients({clients,orders}){
 const[q,setQ]=useState(''),[day,setDay]=useState('');
 const filtered=clients.filter(c=>(!day||c.pickup_day===day||c.delivery_day===day)&&(!q||[c.client_number,c.name,c.phone,c.address,c.zone].some(x=>String(x||'').toLowerCase().includes(q.toLowerCase()))));
 return <div className="card"><div className="section-title"><h2>Clientes</h2><span className="badge">{filtered.length} clientes</span></div><div className="row"><input placeholder="Pesquisar cliente, nº, telefone ou morada" value={q} onChange={e=>setQ(e.target.value)}/><select value={day} onChange={e=>setDay(e.target.value)}><option value="">Todos os dias</option>{dias.map(d=><option key={d[0]} value={d[0]}>{d[1]}</option>)}</select></div><div className="scroll"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Telefone</th><th>Zona</th><th>Recolha</th><th>Entrega</th><th>Encomendas</th></tr></thead><tbody>{filtered.map(c=><tr key={c.id}><td>{c.client_number}</td><td>{c.name}<div className="muted">{c.address}</div></td><td>{c.phone}</td><td>{c.zone}</td><td>{diaLabel(c.pickup_day)}</td><td>{diaLabel(c.delivery_day)}</td><td>{orders.filter(o=>o.client_id===c.id).length}</td></tr>)}</tbody></table></div></div>
}

function Production({user,clients,orders,load}){
 const[clientId,setClientId]=useState(''),[pieces,setPieces]=useState(''),[notes,setNotes]=useState(''),[msg,setMsg]=useState(''),[q,setQ]=useState('');
 const activeClients=clients.filter(c=>!q||[c.client_number,c.name,c.phone].some(x=>String(x||'').toLowerCase().includes(q.toLowerCase())));
 async function create(){setMsg('');if(!clientId)return setMsg('Selecione o cliente.');if(!Number(pieces)||Number(pieces)<1)return setMsg('Indique o número total de peças.');const{error}=await supabase.rpc('create_order',{p_user_id:user.id,p_client_id:clientId,p_pieces:Number(pieces),p_notes:notes});if(error){setMsg(error.message);return}setClientId('');setPieces('');setNotes('');setMsg('Encomenda criada em produção.');load()}
 async function setStatus(id,status){const{error}=await supabase.rpc('update_order_status',{p_user_id:user.id,p_order_id:id,p_new_status:status,p_notes:null});if(error)return alert(error.message);load()}
 return <><div className="card"><h2>Registo rápido de produção</h2><div className="row"><input placeholder="Pesquisar cliente" value={q} onChange={e=>setQ(e.target.value)}/><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecionar cliente</option>{activeClients.slice(0,100).map(c=><option key={c.id} value={c.id}>{c.client_number} - {c.name}</option>)}</select><input type="number" placeholder="Nº peças" value={pieces} onChange={e=>setPieces(e.target.value)}/></div><label>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)}/><button onClick={create}>Guardar encomenda</button>{msg&&<div className={msg.includes('criada')?'success':'warning'}>{msg}</div>}</div><div className="card"><h2>Produção atual</h2><div className="scroll"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Peças</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{orders.filter(o=>['em_producao','pronto_entrega'].includes(o.status)).map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces}</td><td><span className={statusBadge[o.status]}>{statusLabel[o.status]}</span></td><td>{o.status==='em_producao'&&<button className="small-btn ok" onClick={()=>setStatus(o.id,'pronto_entrega')}>Pronto para entrega</button>}<PrintLabelButton order={o}/></td></tr>)}</tbody></table></div></div></>
}

function Drivers({user,clients,orders,load}){
 const driver=user.role==='motorista'; const day=diaHoje();
 const myClients=driver?clients.filter(c=>c.driver_id===user.id):clients.filter(c=>c.pickup_day===day||c.delivery_day===day);
 const ready=orders.filter(o=>o.status==='pronto_entrega'&&(!driver||myClients.some(c=>c.id===o.client_id)));
 async function markPickup(c){const temp=`TEMP-${Date.now()}`;const{error}=await supabase.from('orders').insert({order_number:temp,tracking_code:temp,qr_code:temp,client_id:c.id,client_number:c.client_number,client_name:c.name,driver_id:user.id,driver_name:user.name,pieces:0,status:'recebido_cliente',picked_up_at:new Date().toISOString()});if(error)return alert(error.message);load()}
 async function deliver(o){const{error}=await supabase.rpc('update_order_status',{p_user_id:user.id,p_order_id:o.id,p_new_status:'entregue_cliente',p_notes:null});if(error)return alert(error.message);load()}
 return <div className="card"><h2>{driver?'A minha rota':'Motoristas e rotas'}</h2><div className="grid"><Stat title="Clientes do dia" value={myClients.length}/><Stat title="Para entregar" value={ready.length}/></div><h3>Clientes</h3><div className="scroll"><table><thead><tr><th>Cliente</th><th>Morada</th><th>Ações</th></tr></thead><tbody>{myClients.map(c=><tr key={c.id}><td>{c.client_number} - {c.name}</td><td>{c.address}</td><td><button className="small-btn secondary" onClick={()=>window.open(wazeUrl(c),'_blank')}>Waze</button>{driver&&<button className="small-btn ok" onClick={()=>markPickup(c)}>Recebido do cliente</button>}</td></tr>)}</tbody></table></div><h3>Entregas prontas</h3><div className="scroll"><table><tbody>{ready.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces} peças</td><td>{driver&&<button className="small-btn ok" onClick={()=>deliver(o)}>Entregue ao cliente</button>}</td></tr>)}</tbody></table></div></div>
}

function Communication({user,clients,logs,load}){
 const[day,setDay]=useState(diaHoje()),[target,setTarget]=useState('todos'),[message,setMessage]=useState('Bom dia. A Vincos & Agulha informa que hoje está previsto o seu serviço de recolha/entrega. Obrigado.'),[msg,setMsg]=useState('');
 const recipients=clients.filter(c=>c.active&&(target==='recolha'?c.pickup_day===day:target==='entrega'?c.delivery_day===day:c.pickup_day===day||c.delivery_day===day));
 async function openAll(){await supabase.from('communication_logs').insert({sent_by:user.id,channel:'whatsapp',message_type:'manual',week_day:day,target_type:target,total_clients:recipients.length,message});load();const links=recipients.map(c=>whatsappUrl(c.phone,message.replaceAll('{cliente}',c.name))).filter(Boolean);setMsg(`${links.length} mensagens preparadas. Se o navegador bloquear janelas, use os botões individuais.`);links.slice(0,8).forEach((l,i)=>setTimeout(()=>window.open(l,'_blank'),i*400))}
 return <div className="card"><h2>Comunicação</h2><div className="row"><select value={day} onChange={e=>setDay(e.target.value)}>{dias.map(d=><option value={d[0]} key={d[0]}>{d[1]}</option>)}</select><select value={target} onChange={e=>setTarget(e.target.value)}><option value="todos">Recolhas e entregas</option><option value="recolha">Só recolhas</option><option value="entrega">Só entregas</option></select></div><label>Mensagem</label><textarea value={message} onChange={e=>setMessage(e.target.value)}/><div className="grid"><Stat title="Clientes encontrados" value={recipients.length}/><Stat title="Com WhatsApp" value={recipients.filter(c=>phoneToWhatsapp(c.phone)).length}/></div><button onClick={openAll}>Abrir WhatsApp para todos</button>{msg&&<div className="warning">{msg}</div>}</div>
}

function Reports({clients,orders}){const month=new Date().toISOString().slice(0,7), monthOrders=orders.filter(o=>o.created_at?.slice(0,7)===month);return <div className="card"><h2>Relatórios</h2><div className="grid"><Stat title="Peças no mês" value={monthOrders.reduce((s,o)=>s+Number(o.pieces||0),0)}/><Stat title="Encomendas no mês" value={monthOrders.length}/><Stat title="Clientes ativos" value={clients.filter(c=>c.active).length}/></div></div>}
function ClientPortal({user,orders}){const mine=orders.filter(o=>o.client_id===user.client_id);return <div className="card"><h2>Área do Cliente</h2><OrdersTable orders={mine}/></div>}
function History({orders,events}){return <div className="card"><h2>Histórico</h2><OrdersTable orders={orders} manager/><h3>Eventos recentes</h3><div className="scroll"><table><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString('pt-PT')}</td><td>{e.user_name}</td><td>{statusLabel[e.new_status]||e.new_status}</td></tr>)}</tbody></table></div></div>}

function Admin({currentUser,users,clients,load}){
 const[form,setForm]=useState({name:'',code:'',password:'',role:'funcionario'}),[msg,setMsg]=useState('');
 async function create(){setMsg('');if(!form.name||!form.code||!form.password)return setMsg('Preencha nome, código e senha temporária.');const{error}=await supabase.rpc('create_app_user',{p_manager_id:currentUser.id,p_name:form.name,p_code:form.code,p_temp_password:form.password,p_role:form.role});if(error){setMsg(error.message);return}setMsg('Utilizador criado com sucesso.');setForm({name:'',code:'',password:'',role:'funcionario'});load()}
 async function reset(u){const p=prompt(`Nova senha temporária para ${u.name}:`);if(!p)return;const{error}=await supabase.rpc('reset_user_password',{p_manager_id:currentUser.id,p_user_id:u.id,p_temp_password:p});if(error)return alert(error.message);alert('Senha reposta. O utilizador terá de alterar no próximo acesso.');load()}
 async function toggle(u){const{error}=await supabase.rpc('toggle_user_active',{p_manager_id:currentUser.id,p_user_id:u.id});if(error)return alert(error.message);load()}
 async function role(u,newRole){const{error}=await supabase.rpc('update_user_role',{p_manager_id:currentUser.id,p_user_id:u.id,p_role:newRole});if(error)return alert(error.message);load()}
 return <><div className="card"><h2>Criar utilizador</h2><div className="row"><div><label>Nome</label><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><label>Código de acesso</label><input value={form.code} onChange={e=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="Ex: FUN001"/></div></div><div className="row"><div><label>Senha temporária</label><input type="password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div><div><label>Perfil</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="funcionario">Funcionário</option><option value="motorista">Motorista</option><option value="gerente">Gerente</option></select></div></div><button onClick={create}>Criar utilizador</button>{msg&&<div className={msg.includes('sucesso')?'success':'warning'}>{msg}</div>}</div><div className="card"><div className="section-title"><h2>Utilizadores</h2><span className="badge">{users.length} utilizadores</span></div><div className="scroll"><table><thead><tr><th>Código</th><th>Nome</th><th>Perfil</th><th>Estado</th><th>Último acesso</th><th>Ações</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.access_code}</td><td>{u.name}</td><td>{u.access_code==='GER001'?u.role:<select value={u.role} onChange={e=>role(u,e.target.value)}><option value="funcionario">Funcionário</option><option value="motorista">Motorista</option><option value="gerente">Gerente</option></select>}</td><td>{u.active?<span className="badge b3">Ativo</span>:<span className="badge b1">Inativo</span>}</td><td>{u.last_login_at?new Date(u.last_login_at).toLocaleString('pt-PT'):'-'}</td><td><button className="small-btn secondary" onClick={()=>reset(u)}>Repor senha</button>{u.access_code!=='GER001'&&<button className="small-btn danger" onClick={()=>toggle(u)}>{u.active?'Inativar':'Ativar'}</button>}</td></tr>)}</tbody></table></div></div></>
}

function OrdersTable({orders,manager=false}){return <div className="scroll"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Peças</th><th>Estado</th><th>Data</th>{manager&&<th>Etiqueta</th>}</tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces}</td><td><span className={statusBadge[o.status]}>{statusLabel[o.status]||o.status}</span></td><td>{new Date(o.created_at).toLocaleString('pt-PT')}</td>{manager&&<td><PrintLabelButton order={o}/></td>}</tr>)}{orders.length===0&&<tr><td colSpan={manager?6:5}>Sem registos.</td></tr>}</tbody></table></div>}

function PrintLabelButton({order}){
 const[qr,setQr]=useState('');
 async function print(){const data=await QRCode.toDataURL(order.qr_code||order.order_number);setQr(data);setTimeout(async()=>{await supabase.rpc('mark_label_printed',{p_order_id:order.id});window.print()},200)}
 return <><button className="small-btn secondary" onClick={print}>Etiqueta</button>{qr&&<div className="label-preview print-label"><h2>Vincos & Agulha</h2><p><b>{order.order_number}</b></p><p>{order.client_name}</p><p>Peças: {order.pieces}</p><img src={qr} width="120" height="120"/><div className="qr">{order.qr_code}</div></div>}</>
}

createRoot(document.getElementById('root')).render(<App/>);