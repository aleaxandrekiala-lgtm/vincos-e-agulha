import React,{useEffect,useState}from'react';
import{createRoot}from'react-dom/client';
import{createClient}from'@supabase/supabase-js';
import QRCode from'qrcode';
import'./styles.css';

const supabaseUrl=import.meta.env.VITE_SUPABASE_URL;
const supabaseKey=import.meta.env.VITE_SUPABASE_ANON_KEY;
const hasConfig=Boolean(supabaseUrl&&supabaseKey);
const supabase=hasConfig?createClient(supabaseUrl,supabaseKey):null;

const statusLabel={
  recebido_cliente:'Recebido do cliente',
  em_producao:'Em produção',
  pronto_entrega:'Pronto para entrega',
  entregue_cliente:'Entregue ao cliente'
};
const statusBadge={
  recebido_cliente:'badge b1',
  em_producao:'badge b2',
  pronto_entrega:'badge b4',
  entregue_cliente:'badge b3'
};

function Header(){return <header><div className="logo">V&A</div><h1>Vincos & Agulha</h1><p>Versão 1.0 RC — Produção e encomendas</p></header>}
function MissingConfig(){return <><Header/><main><section className="card login"><h2>Configuração em falta</h2><div className="error">Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel.</div></section></main></>}

function Login({onLogin}){const[code,setCode]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
async function submit(){setError('');const{data,error}=await supabase.rpc('login_user',{p_code:code,p_password:password});if(error){setError(error.message);return}if(!data||!data.length){setError('Código ou senha incorretos.');return}onLogin(data[0])}
return <section className="card login"><h2>Entrar</h2><label>Código</label><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}/><label>Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/><button onClick={submit}>Entrar</button><p className="muted">Gerente inicial: GER001 / 123456</p>{error&&<div className="warning">{error}</div>}</section>}

function App(){
  const[user,setUser]=useState(null),[tab,setTab]=useState('dashboard'),[clients,setClients]=useState([]),[orders,setOrders]=useState([]),[events,setEvents]=useState([]);
  async function load(){
    const[c,o,e]=await Promise.all([
      supabase.from('clients').select('*').order('client_number'),
      supabase.from('orders').select('*').order('created_at',{ascending:false}),
      supabase.from('order_events').select('*').order('created_at',{ascending:false})
    ]);
    setClients(c.data||[]);setOrders(o.data||[]);setEvents(e.data||[]);
  }
  useEffect(()=>{if(user)load()},[user]);
  if(!hasConfig)return <MissingConfig/>;
  if(!user)return <><Header/><main><Login onLogin={setUser}/></main></>;
  const manager=user.role==='gerente', staff=user.role==='funcionario'||manager, driver=user.role==='motorista', client=user.role==='cliente';
  return <><Header/><main><section className="card"><b>Sessão:</b> {user.name} | <b>Perfil:</b> {user.role}<button className="danger" onClick={()=>setUser(null)} style={{marginTop:10}}>Sair</button></section>
  <div className="tabs">
    {manager&&<button onClick={()=>setTab('dashboard')}>Dashboard</button>}
    {staff&&<button onClick={()=>setTab('producao')}>Produção</button>}
    {driver&&<button onClick={()=>setTab('motorista')}>Motorista</button>}
    {client&&<button onClick={()=>setTab('cliente')}>Área do Cliente</button>}
    {manager&&<button onClick={()=>setTab('historico')}>Histórico</button>}
  </div>
  {tab==='dashboard'&&manager&&<Dashboard orders={orders}/>}
  {tab==='producao'&&staff&&<Production user={user} clients={clients} orders={orders} load={load}/>}
  {tab==='motorista'&&driver&&<DriverPanel user={user} clients={clients} orders={orders} load={load}/>}
  {tab==='cliente'&&client&&<ClientPortal user={user} orders={orders}/>}
  {tab==='historico'&&manager&&<History orders={orders} events={events}/>}
  <div className="footer">Vincos & Agulha — V1.0 RC</div></main></>
}

function Dashboard({orders}){
  const today=new Date().toISOString().slice(0,10);
  const todayOrders=orders.filter(o=>o.created_at?.slice(0,10)===today);
  return <section className="card"><h2>Dashboard</h2><div className="grid"><Stat title="Encomendas hoje" value={todayOrders.length}/><Stat title="Peças hoje" value={todayOrders.reduce((s,o)=>s+Number(o.pieces||0),0)}/><Stat title="Em produção" value={orders.filter(o=>o.status==='em_producao').length}/><Stat title="Prontas" value={orders.filter(o=>o.status==='pronto_entrega').length}/><Stat title="Entregues" value={orders.filter(o=>o.status==='entregue_cliente').length}/></div><h3>Últimas encomendas</h3><OrdersTable orders={orders.slice(0,15)} manager/></section>
}
function Stat({title,value}){return <div className="card"><div className="muted">{title}</div><div className="stat">{value}</div></div>}

function Production({user,clients,orders,load}){
  const[clientId,setClientId]=useState(''),[pieces,setPieces]=useState(''),[notes,setNotes]=useState(''),[msg,setMsg]=useState('');
  async function create(){
    setMsg('');
    if(!clientId)return setMsg('Selecione o cliente.');
    if(!Number(pieces)||Number(pieces)<1)return setMsg('Indique o número total de peças.');
    const{error}=await supabase.rpc('create_order',{p_user_id:user.id,p_client_id:clientId,p_pieces:Number(pieces),p_notes:notes});
    if(error){setMsg(error.message);return}
    setClientId('');setPieces('');setNotes('');setMsg('Encomenda criada e colocada em produção.');load();
  }
  async function setStatus(orderId,status){
    const{error}=await supabase.rpc('update_order_status',{p_user_id:user.id,p_order_id:orderId,p_new_status:status,p_notes:null});
    if(error)return alert(error.message);load();
  }
  return <section className="card"><h2>Produção</h2><div className="row"><div><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecionar cliente</option>{clients.map(c=><option key={c.id} value={c.id}>{c.client_number} - {c.name}</option>)}</select></div><div><label>Número total de peças</label><input type="number" value={pieces} onChange={e=>setPieces(e.target.value)}/></div></div><label>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)}/><button onClick={create}>Guardar encomenda</button>{msg&&<div className={msg.includes('criada')?'success':'warning'}>{msg}</div>}<h3>Encomendas em produção/prontas</h3><div className="scroll"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Peças</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{orders.filter(o=>['em_producao','pronto_entrega'].includes(o.status)).map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces}</td><td><span className={statusBadge[o.status]}>{statusLabel[o.status]}</span></td><td>{o.status==='em_producao'&&<button className="small-btn ok" onClick={()=>setStatus(o.id,'pronto_entrega')}>Pronto para entrega</button>}<PrintLabelButton order={o}/></td></tr>)}</tbody></table></div></section>
}

function DriverPanel({user,clients,orders,load}){
  const myClients=clients.filter(c=>c.driver_id===user.id);
  const pendingPickup=myClients.map(c=>({client:c,order:orders.find(o=>o.client_id===c.id&&o.status!=='entregue_cliente')})).filter(x=>!x.order);
  const ready=orders.filter(o=>o.status==='pronto_entrega'&&myClients.some(c=>c.id===o.client_id));
  async function createPickup(client){
    const{error}=await supabase.from('orders').insert({
      order_number:`TEMP-${Date.now()}`,
      tracking_code:`TEMP-${Date.now()}`,
      qr_code:`TEMP-${Date.now()}`,
      client_id:client.id,
      client_number:client.client_number,
      client_name:client.name,
      driver_id:user.id,
      driver_name:user.name,
      pieces:0,
      status:'recebido_cliente',
      picked_up_at:new Date().toISOString()
    });
    if(error)return alert(error.message);load();
  }
  async function deliver(order){
    const{error}=await supabase.rpc('update_order_status',{p_user_id:user.id,p_order_id:order.id,p_new_status:'entregue_cliente',p_notes:null});
    if(error)return alert(error.message);load();
  }
  return <section className="card"><h2>Motorista</h2><div className="grid"><Stat title="Por recolher" value={pendingPickup.length}/><Stat title="Para entregar" value={ready.length}/></div><h3>Recolhas</h3><div className="scroll"><table><thead><tr><th>Cliente</th><th>Morada</th><th>Ação</th></tr></thead><tbody>{pendingPickup.map(({client})=><tr key={client.id}><td>{client.client_number} - {client.name}</td><td>{client.address}</td><td><button className="small-btn ok" onClick={()=>createPickup(client)}>Recebido do cliente</button></td></tr>)}</tbody></table></div><h3>Entregas</h3><div className="scroll"><table><thead><tr><th>Encomenda</th><th>Cliente</th><th>Peças</th><th>Ação</th></tr></thead><tbody>{ready.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces}</td><td><button className="small-btn ok" onClick={()=>deliver(o)}>Entregue ao cliente</button></td></tr>)}</tbody></table></div></section>
}

function ClientPortal({user,orders}){
  const mine=orders.filter(o=>o.client_id===user.client_id);
  return <section className="card"><h2>Área do Cliente</h2><OrdersTable orders={mine}/></section>
}

function History({orders,events}){return <section className="card"><h2>Histórico</h2><OrdersTable orders={orders} manager/><h3>Eventos</h3><div className="scroll"><table><thead><tr><th>Data</th><th>Encomenda</th><th>Utilizador</th><th>Evento</th><th>Estado</th></tr></thead><tbody>{events.map(e=><tr key={e.id}><td>{new Date(e.created_at).toLocaleString('pt-PT')}</td><td>{e.order_id}</td><td>{e.user_name}</td><td>{e.event_type}</td><td>{statusLabel[e.new_status]||e.new_status}</td></tr>)}</tbody></table></div></section>}

function OrdersTable({orders,manager=false}){return <div className="scroll"><table><thead><tr><th>Nº Encomenda</th><th>Cliente</th><th>Peças</th><th>Estado</th><th>Data</th>{manager&&<th>Etiqueta</th>}</tr></thead><tbody>{orders.map(o=><tr key={o.id}><td>{o.order_number}</td><td>{o.client_name}</td><td>{o.pieces}</td><td><span className={statusBadge[o.status]}>{statusLabel[o.status]||o.status}</span></td><td>{new Date(o.created_at).toLocaleString('pt-PT')}</td>{manager&&<td><PrintLabelButton order={o}/></td>}</tr>)}{orders.length===0&&<tr><td colSpan={manager?6:5}>Sem encomendas.</td></tr>}</tbody></table></div>}

function PrintLabelButton({order}){
  const[qr,setQr]=useState('');
  async function print(){
    const data=await QRCode.toDataURL(order.qr_code||order.order_number);
    setQr(data);
    setTimeout(async()=>{
      await supabase.rpc('mark_label_printed',{p_order_id:order.id});
      window.print();
    },200);
  }
  return <><button className="small-btn secondary" onClick={print}>Imprimir etiqueta</button>{qr&&<div className="label-preview print-label"><h2>Vincos & Agulha</h2><p><b>{order.order_number}</b></p><p>{order.client_name}</p><p>Peças: {order.pieces}</p><img src={qr} width="120" height="120"/><div className="qr">{order.qr_code}</div></div>}</>
}

createRoot(document.getElementById('root')).render(<App/>);