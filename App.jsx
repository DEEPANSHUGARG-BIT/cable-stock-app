import { useState, useEffect } from "react";

const CABLE_SIZES = [
  "16x4", "25x4", "35x4", "50x3.5", "70x3.5",
  "95x3.5", "120x3.5", "150x3.5", "185x3.5", "240x3.5", "300x3.5"
];

const initStock = () => {
  const s = {};
  CABLE_SIZES.forEach(sz => { s[sz] = { drums: [], sales: [] }; });
  return s;
};

function totalMeters(drums) {
  return drums.reduce((s, d) => s + (d.remaining ?? d.qty), 0);
}

function totalSold(sales) {
  return sales.reduce((s, t) => s + t.qty, 0);
}

function loadStock() {
  try {
    const raw = localStorage.getItem("cable_stock_v1");
    if (!raw) return initStock();
    const parsed = JSON.parse(raw);
    // Rehydrate dates
    CABLE_SIZES.forEach(sz => {
      if (!parsed[sz]) { parsed[sz] = { drums: [], sales: [] }; return; }
      parsed[sz].drums = (parsed[sz].drums || []).map(d => ({ ...d, addedOn: new Date(d.addedOn) }));
      parsed[sz].sales = (parsed[sz].sales || []).map(s => ({ ...s, date: new Date(s.date) }));
    });
    return parsed;
  } catch { return initStock(); }
}

export default function App() {
  const [stock, setStock] = useState(loadStock);
  const [activeSize, setActiveSize] = useState("16x4");
  const [modal, setModal] = useState(null);
  const [drumForm, setDrumForm] = useState({ drumNo: "", qty: "" });
  const [sellForm, setSellForm] = useState({ drumId: null, qty: "", note: "" });
  const [toast, setToast] = useState(null);

  // Persist to localStorage on every change
  useEffect(() => {
    localStorage.setItem("cable_stock_v1", JSON.stringify(stock));
  }, [stock]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const data = stock[activeSize];
  const total = totalMeters(data.drums);
  const sold = totalSold(data.sales);
  const activeDrums = data.drums.filter(d => d.remaining > 0);
  const selectedDrum = data.drums.find(d => d.id === sellForm.drumId) || null;

  const handleAddDrum = () => {
    const qty = parseFloat(drumForm.qty);
    if (!drumForm.drumNo.trim() || !qty || qty <= 0) { showToast("Fill all fields correctly", "err"); return; }
    setStock(prev => ({
      ...prev,
      [activeSize]: {
        ...prev[activeSize],
        drums: [...prev[activeSize].drums, {
          id: Date.now(), drumNo: drumForm.drumNo.trim(), qty, remaining: qty, addedOn: new Date()
        }]
      }
    }));
    setDrumForm({ drumNo: "", qty: "" });
    setModal(null);
    showToast(`Drum ${drumForm.drumNo} added — ${qty}m`);
  };

  const handleSell = () => {
    const qty = parseFloat(sellForm.qty);
    if (!sellForm.drumId) { showToast("Select a drum", "err"); return; }
    if (!qty || qty <= 0) { showToast("Enter valid quantity", "err"); return; }
    if (!selectedDrum) { showToast("Drum not found", "err"); return; }
    if (qty > selectedDrum.remaining) { showToast(`Only ${selectedDrum.remaining}m left in this drum`, "err"); return; }

    setStock(prev => {
      const updatedDrums = prev[activeSize].drums.map(d =>
        d.id === sellForm.drumId ? { ...d, remaining: d.remaining - qty } : d
      );
      const updatedSales = [...prev[activeSize].sales, {
        id: Date.now(), qty, drumId: sellForm.drumId,
        drumNo: selectedDrum.drumNo, note: sellForm.note.trim(), date: new Date()
      }];
      return { ...prev, [activeSize]: { drums: updatedDrums, sales: updatedSales } };
    });

    setSellForm({ drumId: null, qty: "", note: "" });
    setModal(null);
    showToast(`Sold ${qty}m from Drum ${selectedDrum.drumNo}`);
  };

  const openSell = () => {
    const avail = data.drums.filter(d => d.remaining > 0);
    setSellForm({ drumId: avail.length === 1 ? avail[0].id : null, qty: "", note: "" });
    setModal("sell");
  };

  const allSizes = CABLE_SIZES.map(sz => ({
    sz, meters: totalMeters(stock[sz].drums)
  }));

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#111", fontFamily: "'Inter', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Geist+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #f5f5f5; }
        ::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
        .sz-chip { cursor:pointer; padding:7px 14px; font-size:13px; font-weight:500; border:1px solid #e5e5e5; background:#fff; color:#666; transition:all 0.12s; position:relative; font-family:'Geist Mono',monospace; letter-spacing:0.3px; }
        .sz-chip:hover { border-color:#111; color:#111; }
        .sz-chip.active { background:#111; color:#fff; border-color:#111; }
        .sz-chip .indicator { position:absolute; top:4px; right:4px; width:5px; height:5px; border-radius:50%; }
        .sz-chip.active .indicator { display:none; }
        .btn { border:none; cursor:pointer; font-family:'Inter',sans-serif; font-weight:500; transition:all 0.12s; font-size:13px; }
        .btn-dark { background:#111; color:#fff; padding:9px 20px; }
        .btn-dark:hover { background:#333; }
        .btn-dark:disabled { opacity:0.3; cursor:not-allowed; }
        .btn-ghost { background:#fff; color:#111; border:1px solid #e5e5e5; padding:8px 18px; }
        .btn-ghost:hover { border-color:#111; }
        .inp { background:#fff; border:1px solid #e5e5e5; color:#111; padding:10px 13px; font-family:'Geist Mono',monospace; font-size:13px; width:100%; transition:border 0.15s; }
        .inp:focus { outline:none; border-color:#111; }
        .inp::placeholder { color:#bbb; }
        .inp:disabled { opacity:0.4; background:#fafafa; }
        .drum-opt { padding:12px 14px; border:1px solid #e5e5e5; cursor:pointer; transition:all 0.1s; display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
        .drum-opt:hover { border-color:#111; }
        .drum-opt.sel { border-color:#111; background:#f9f9f9; }
        .drum-opt.empty-drum { opacity:0.35; cursor:not-allowed; pointer-events:none; }
        .modal-bg { position:fixed; inset:0; background:rgba(0,0,0,0.12); display:flex; align-items:center; justify-content:center; z-index:50; padding:16px; }
        .modal { background:#fff; border:1px solid #e5e5e5; padding:28px; width:100%; max-width:400px; box-shadow:0 8px 40px rgba(0,0,0,0.08); max-height:90vh; overflow-y:auto; }
        .toast { position:fixed; bottom:20px; right:20px; background:#111; color:#fff; padding:11px 18px; font-size:12px; z-index:100; animation:fadeUp 0.2s ease; font-weight:500; }
        .toast.err { background:#ef4444; }
        @keyframes fadeUp { from{transform:translateY(6px);opacity:0} to{transform:translateY(0);opacity:1} }
        .bar-bg { background:#f0f0f0; height:3px; overflow:hidden; }
        .bar-fill { height:3px; transition:width 0.3s ease; }
        table { border-collapse:collapse; width:100%; }
        th { font-size:10px; letter-spacing:1px; color:#aaa; text-align:left; padding:10px 16px; border-bottom:1px solid #f0f0f0; font-weight:500; text-transform:uppercase; }
        td { padding:12px 16px; font-size:13px; border-bottom:1px solid #f7f7f7; color:#333; }
        tr:last-child td { border-bottom:none; }
        tr:hover td { background:#fafafa; }
        .label { font-size:10px; color:#aaa; letter-spacing:1px; text-transform:uppercase; font-weight:500; margin-bottom:6px; display:block; }
        .num { font-family:'Geist Mono',monospace; }
        @media(max-width:700px){
          .main-grid { grid-template-columns:1fr !important; }
          .stats-grid { grid-template-columns:repeat(3,1fr) !important; }
          .sidebar { display:none; }
          .header-pad { padding:0 16px !important; }
          .body-pad { padding:16px !important; }
        }
      `}</style>

      {/* HEADER */}
      <div style={{ borderBottom:"1px solid #f0f0f0", padding:"0 28px" }} className="header-pad">
        <div style={{ maxWidth:1080, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:54 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:6, height:28, background:"#111" }} />
            <div>
              <div style={{ fontSize:15, fontWeight:600, letterSpacing:"-0.3px", color:"#111" }}>AL/AR Cable Stock</div>
              <div style={{ fontSize:10, color:"#bbb", letterSpacing:"0.5px" }}>Drum-wise inventory</div>
            </div>
          </div>
          <div style={{ fontSize:11, color:"#ccc", fontFamily:"'Geist Mono',monospace" }}>
            {new Date().toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"})}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:1080, margin:"0 auto", padding:"24px 28px" }} className="body-pad">

        {/* SIZE CHIPS */}
        <div style={{ marginBottom:28 }}>
          <span className="label">Cable Size (sqmm × cores)</span>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {CABLE_SIZES.map(sz => {
              const m = totalMeters(stock[sz].drums);
              const hasStock = m > 0;
              const isLow = hasStock && m < 100;
              return (
                <div key={sz} className={`sz-chip ${activeSize===sz?"active":""}`} onClick={()=>setActiveSize(sz)}>
                  {sz}
                  <span className="indicator" style={{ background:!hasStock?"#e5e5e5":isLow?"#f97316":"#22c55e" }} />
                </div>
              );
            })}
          </div>
        </div>

        {/* MAIN */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:24, alignItems:"start" }} className="main-grid">
          <div>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:1, border:"1px solid #f0f0f0", marginBottom:24 }} className="stats-grid">
              {[
                { label:"Available", value:`${total.toLocaleString()}`, unit:"metres" },
                { label:"Active Drums", value:activeDrums.length, unit:`of ${data.drums.length} total` },
                { label:"Total Sold", value:`${sold.toLocaleString()}`, unit:"metres" },
              ].map((s,i)=>(
                <div key={i} style={{ padding:"18px 20px", background:"#fff", borderRight:i<2?"1px solid #f0f0f0":"none" }}>
                  <div className="label">{s.label}</div>
                  <div className="num" style={{ fontSize:26, fontWeight:600, color:"#111", lineHeight:1.1 }}>{s.value}</div>
                  <div style={{ fontSize:11, color:"#bbb", marginTop:3 }}>{s.unit}</div>
                </div>
              ))}
            </div>

            {/* Drums */}
            <div style={{ border:"1px solid #f0f0f0" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid #f0f0f0", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#111" }}>
                  {activeSize} sqmm <span style={{ fontSize:11, color:"#bbb", fontWeight:400, marginLeft:6 }}>drums</span>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn btn-ghost" onClick={openSell} disabled={activeDrums.length===0} style={{ opacity:activeDrums.length===0?0.35:1 }}>Record Sale</button>
                  <button className="btn btn-dark" onClick={()=>{ setDrumForm({drumNo:"",qty:""}); setModal("addDrum"); }}>+ Add Drum</button>
                </div>
              </div>
              {data.drums.length===0 ? (
                <div style={{ padding:"44px 16px", textAlign:"center" }}>
                  <div style={{ fontSize:13, color:"#bbb" }}>No drums added yet</div>
                  <div style={{ fontSize:11, color:"#ddd", marginTop:4 }}>Add your first drum for {activeSize}</div>
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table>
                    <thead><tr><th>Drum No.</th><th>Original</th><th>Remaining</th><th>Used</th><th>Fill</th><th>Added</th></tr></thead>
                    <tbody>
                      {data.drums.map(d=>{
                        const pct=d.qty>0?(d.remaining/d.qty)*100:0;
                        const isEmpty=d.remaining===0;
                        const isLow=!isEmpty&&pct<20;
                        const barColor=isEmpty?"#e5e5e5":isLow?"#f97316":"#22c55e";
                        return (
                          <tr key={d.id}>
                            <td><span className="num" style={{ fontWeight:600,color:"#111" }}>{d.drumNo}</span>{isEmpty&&<span style={{ marginLeft:8,fontSize:10,color:"#bbb",background:"#f5f5f5",padding:"1px 6px" }}>empty</span>}</td>
                            <td><span className="num" style={{ color:"#999" }}>{d.qty.toLocaleString()}m</span></td>
                            <td><span className="num" style={{ fontWeight:600,color:isEmpty?"#ccc":isLow?"#f97316":"#111" }}>{d.remaining.toLocaleString()}m</span></td>
                            <td><span className="num" style={{ color:"#bbb" }}>{(d.qty-d.remaining).toLocaleString()}m</span></td>
                            <td style={{ width:100 }}>
                              <div className="bar-bg" style={{ width:80 }}><div className="bar-fill" style={{ width:`${pct}%`,background:barColor }} /></div>
                              <div className="num" style={{ fontSize:10,color:"#bbb",marginTop:2 }}>{isEmpty?"empty":isLow?"low":`${Math.round(pct)}%`}</div>
                            </td>
                            <td style={{ color:"#bbb",fontSize:11 }}>{d.addedOn.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="sidebar">
            <div style={{ border:"1px solid #f0f0f0" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid #f0f0f0" }}><span className="label" style={{ marginBottom:0 }}>All Sizes</span></div>
              {allSizes.map(({sz,meters})=>{
                const maxM=Math.max(...allSizes.map(x=>x.meters),1);
                const pct=meters>0?(meters/maxM)*100:0;
                const isActive=sz===activeSize;
                return (
                  <div key={sz} onClick={()=>setActiveSize(sz)} style={{ padding:"9px 16px",cursor:"pointer",background:isActive?"#f9f9f9":"transparent",borderLeft:`2px solid ${isActive?"#111":"transparent"}`,transition:"all 0.1s" }}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                      <span className="num" style={{ fontSize:12,fontWeight:isActive?600:400,color:isActive?"#111":"#888" }}>{sz}</span>
                      <span className="num" style={{ fontSize:11,color:meters>0?"#333":"#ddd" }}>{meters>0?`${meters.toLocaleString()}m`:"—"}</span>
                    </div>
                    <div className="bar-bg"><div className="bar-fill" style={{ width:`${pct}%`,background:isActive?"#111":"#ccc" }} /></div>
                  </div>
                );
              })}
            </div>
            <div style={{ border:"1px solid #f0f0f0" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid #f0f0f0" }}><span className="label" style={{ marginBottom:0 }}>Sales — {activeSize}</span></div>
              {data.sales.length===0?(
                <div style={{ padding:"24px 16px",color:"#ccc",fontSize:12,textAlign:"center" }}>No sales yet</div>
              ):(
                <div style={{ maxHeight:260,overflowY:"auto" }}>
                  {[...data.sales].reverse().map(s=>(
                    <div key={s.id} style={{ padding:"10px 16px",borderBottom:"1px solid #f7f7f7",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                      <div>
                        <div className="num" style={{ fontSize:14,fontWeight:600,color:"#111" }}>{s.qty.toLocaleString()}m</div>
                        <div style={{ fontSize:10,color:"#bbb",marginTop:1 }}>Drum {s.drumNo}{s.note?` · ${s.note}`:""}</div>
                      </div>
                      <div className="num" style={{ fontSize:10,color:"#bbb",textAlign:"right" }}>
                        {s.date.toLocaleDateString("en-IN",{day:"2-digit",month:"short"})}<br/>
                        {s.date.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ADD DRUM MODAL */}
      {modal==="addDrum"&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="label">Add Drum</div>
            <div className="num" style={{ fontSize:20,fontWeight:600,marginBottom:22,color:"#111" }}>{activeSize} sqmm</div>
            <div style={{ marginBottom:14 }}>
              <label className="label">Drum Number / Label</label>
              <input className="inp" placeholder="e.g. D-001" value={drumForm.drumNo} onChange={e=>setDrumForm(f=>({...f,drumNo:e.target.value}))} />
            </div>
            <div style={{ marginBottom:22 }}>
              <label className="label">Quantity in this drum (metres)</label>
              <input className="inp" type="number" min="1" placeholder="500" value={drumForm.qty} onChange={e=>setDrumForm(f=>({...f,qty:e.target.value}))} />
            </div>
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-dark" style={{ flex:2 }} onClick={handleAddDrum}>Add Drum</button>
            </div>
          </div>
        </div>
      )}

      {/* SELL MODAL */}
      {modal==="sell"&&(
        <div className="modal-bg" onClick={e=>e.target===e.currentTarget&&setModal(null)}>
          <div className="modal">
            <div className="label">Record Sale</div>
            <div className="num" style={{ fontSize:20,fontWeight:600,marginBottom:4,color:"#111" }}>{activeSize} sqmm</div>
            <div style={{ fontSize:12,color:"#aaa",marginBottom:20 }}>
              Total available: <span className="num" style={{ color:"#111",fontWeight:600 }}>{total.toLocaleString()}m</span>
            </div>
            <div style={{ marginBottom:18 }}>
              <label className="label">Select drum to deduct from</label>
              {data.drums.map(d=>{
                const isEmpty=d.remaining===0;
                const isSelected=sellForm.drumId===d.id;
                const pct=d.qty>0?Math.round((d.remaining/d.qty)*100):0;
                return (
                  <div key={d.id} className={`drum-opt ${isSelected?"sel":""} ${isEmpty?"empty-drum":""}`} onClick={()=>!isEmpty&&setSellForm(f=>({...f,drumId:d.id,qty:""}))}>
                    <div>
                      <div className="num" style={{ fontWeight:600,fontSize:14,color:"#111" }}>{d.drumNo}</div>
                      <div style={{ fontSize:10,color:"#aaa",marginTop:2 }}>{isEmpty?"empty":`${d.remaining.toLocaleString()}m remaining · ${pct}% full`}</div>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:10 }}>
                      {!isEmpty&&<div style={{ width:40 }}><div className="bar-bg"><div className="bar-fill" style={{ width:`${pct}%`,background:pct<20?"#f97316":"#22c55e" }} /></div></div>}
                      <div style={{ width:16,height:16,border:`1.5px solid ${isSelected?"#111":"#ddd"}`,borderRadius:"50%",background:isSelected?"#111":"#fff",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                        {isSelected&&<div style={{ width:6,height:6,borderRadius:"50%",background:"#fff" }} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom:14 }}>
              <label className="label">Qty sold (metres){selectedDrum&&<span style={{ color:"#bbb",marginLeft:6 }}>max {selectedDrum.remaining.toLocaleString()}m</span>}</label>
              <input className="inp" type="number" min="1" max={selectedDrum?selectedDrum.remaining:undefined}
                placeholder={selectedDrum?`max ${selectedDrum.remaining}`:"select a drum first"}
                disabled={!selectedDrum} value={sellForm.qty}
                onChange={e=>setSellForm(f=>({...f,qty:e.target.value}))}
                style={{ fontSize:20,fontWeight:600,textAlign:"center" }} />
              {selectedDrum&&parseFloat(sellForm.qty)>selectedDrum.remaining&&(
                <div style={{ color:"#ef4444",fontSize:11,marginTop:4 }}>Exceeds available in {selectedDrum.drumNo} ({selectedDrum.remaining}m)</div>
              )}
            </div>
            <div style={{ marginBottom:20 }}>
              <label className="label">Note (optional)</label>
              <input className="inp" placeholder="Customer / site / order ref" value={sellForm.note} onChange={e=>setSellForm(f=>({...f,note:e.target.value}))} />
            </div>
            {selectedDrum&&parseFloat(sellForm.qty)>0&&parseFloat(sellForm.qty)<=selectedDrum.remaining&&(
              <div style={{ background:"#f9f9f9",border:"1px solid #f0f0f0",padding:"12px 14px",marginBottom:20 }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:10,color:"#aaa" }}>Drum {selectedDrum.drumNo} after sale</div>
                    <div className="num" style={{ fontSize:18,fontWeight:600,color:"#111",marginTop:2 }}>{(selectedDrum.remaining-parseFloat(sellForm.qty)).toLocaleString()}m left</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:10,color:"#aaa" }}>Total stock after</div>
                    <div className="num" style={{ fontSize:18,fontWeight:600,color:"#111",marginTop:2 }}>{(total-parseFloat(sellForm.qty)).toLocaleString()}m</div>
                  </div>
                </div>
              </div>
            )}
            <div style={{ display:"flex",gap:8 }}>
              <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setModal(null)}>Cancel</button>
              <button className="btn btn-dark" style={{ flex:2 }}
                disabled={!sellForm.drumId||!sellForm.qty||parseFloat(sellForm.qty)>(selectedDrum?.remaining??0)}
                onClick={handleSell}>Confirm Sale</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className={`toast ${toast.type==="err"?"err":""}`}>{toast.msg}</div>}
    </div>
  );
}
