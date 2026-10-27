// Painel de convite por código (HTML sobre o jogo): precisa de caixas de texto para copiar e colar, o que o canvas não faz.
// Anfitrião: gera o convite, o amigo devolve a resposta, o anfitrião cola e conecta. Convidado: cola o convite e devolve a resposta.
(function (root) {
  'use strict';
  const DP = root.DP = root.DP || {};
  let box = null, timer = null;

  function css() {
    if (document.getElementById('p2pcss')) return;
    const st = document.createElement('style'); st.id = 'p2pcss';
    st.textContent = `
#p2p { position: fixed; inset: 0; z-index: 50; background: rgba(8,8,12,.94); color: #e8e6ef; font: 700 12px/1.45 ui-monospace, Menlo, Consolas, monospace; text-transform: uppercase; display: flex; align-items: center; justify-content: center; padding: 10px; box-sizing: border-box; -webkit-user-select: text; user-select: text; }
#p2p .in { width: min(440px, 100%); max-height: 100%; overflow: auto; }
#p2p h1 { margin: 0 0 6px; font-size: 14px; color: #ffd23f; letter-spacing: 1px; }
#p2p p { margin: 4px 0; color: #9a9aa8; font-size: 11px; }
#p2p p.hot { color: #ff9d5c; }
#p2p p.ok { color: #7dffa0; }
#p2p label { display: block; margin: 8px 0 2px; color: #cfd3e0; }
#p2p textarea { width: 100%; box-sizing: border-box; height: 64px; background: #14141c; color: #7ad0ff; border: 2px solid #3b3b47; font: 11px/1.3 ui-monospace, Menlo, Consolas, monospace; padding: 5px; resize: none; text-transform: none; word-break: break-all; -webkit-user-select: text; user-select: text; }
#p2p .row { display: flex; gap: 6px; margin-top: 5px; flex-wrap: wrap; }
#p2p button { flex: 1; min-width: 90px; background: #1b1b26; color: #ffd23f; border: 2px solid #ffd23f; font: inherit; padding: 8px 6px; cursor: pointer; text-transform: uppercase; }
#p2p button.gr { color: #8a8a99; border-color: #5d5d69; }
#p2p button:disabled { opacity: .35; cursor: default; }`;
    document.head.appendChild(st);
  }

  function el(tag, props, kids) {
    const e = document.createElement(tag);
    Object.assign(e, props || {});
    (kids || []).forEach((k) => e.appendChild(typeof k === 'string' ? document.createTextNode(k) : k));
    return e;
  }

  function close() {
    clearInterval(timer); timer = null;
    if (box && box.parentNode) box.parentNode.removeChild(box);
    box = null;
    try { const c = document.getElementById('c'); if (c) c.focus({ preventScroll: true }); } catch (e) { /* sem foco */ }
  }

  function shell(title) {
    css(); close();
    box = el('div', { id: 'p2p' });
    // o jogo escuta teclado e toque na janela inteira: aqui dentro nada disso deve passar
    ['keydown', 'keyup', 'pointerdown', 'pointerup', 'pointermove', 'contextmenu'].forEach((n) => box.addEventListener(n, (e) => e.stopPropagation()));
    const inner = el('div', { className: 'in' }, [el('h1', { textContent: title })]);
    box.appendChild(inner); document.body.appendChild(box);
    return inner;
  }

  function copyOf(ta, btn) {
    return () => {
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      if (!ok && navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(() => { btn.textContent = 'COPIADO!'; }, () => { btn.textContent = 'SEGURE E COPIE'; }); return; }
      btn.textContent = ok ? 'COPIADO!' : 'SEGURE E COPIE';
    };
  }
  function shareOf(ta) {
    if (!navigator.share) return null;
    return el('button', { textContent: 'ENVIAR...', onclick: () => { navigator.share({ text: ta.value }).catch(() => {}); } });
  }
  const stateText = (s) => ({ new: 'AGUARDANDO', connecting: 'CONECTANDO...', connected: 'CONECTADO', failed: 'NÃO CONECTOU', disconnected: 'CAIU', closed: 'FECHADO', open: 'CONECTADO' }[s] || s);

  // ---------- anfitrião ----------
  function invite(p2p, hooks) {
    hooks = hooks || {};
    const inner = shell('CONVIDAR UM AMIGO');
    const info = el('p', { textContent: 'PASSO 1: GERANDO O CONVITE...' });
    const ta1 = el('textarea', { readOnly: true, placeholder: '...' });
    const b1 = el('button', { textContent: 'COPIAR CONVITE', disabled: true });
    const row1 = el('div', { className: 'row' }, [b1]);
    const ta2 = el('textarea', { placeholder: 'COLE AQUI A RESPOSTA DO AMIGO' });
    const go = el('button', { textContent: 'CONECTAR', disabled: true });
    const status = el('p', { textContent: '' });
    const end = el('button', { className: 'gr', textContent: 'FECHAR', onclick: () => { close(); if (hooks.onClose) hooks.onClose(); } });
    inner.appendChild(info);
    inner.appendChild(el('label', { textContent: '1. MANDE ESTE CÓDIGO PARA O AMIGO' })); inner.appendChild(ta1); inner.appendChild(row1);
    inner.appendChild(el('label', { textContent: '2. COLE A RESPOSTA QUE ELE DEVOLVER' })); inner.appendChild(ta2);
    inner.appendChild(el('div', { className: 'row' }, [go, end])); inner.appendChild(status);
    inner.appendChild(el('p', { textContent: 'O CONVITE SERVE PARA UMA PESSOA. PARA OUTRO AMIGO, ABRA CONVIDAR DE NOVO. SE NÃO CONECTAR, A REDE DE UM DOS DOIS PODE BLOQUEAR CONEXÃO DIRETA (COMUM EM DADOS MÓVEIS).' }));
    const shr = shareOf(ta1); if (shr) row1.appendChild(shr);
    let inv = null, finished = false, t0 = 0;
    p2p.invite().then((r) => {
      inv = r; ta1.value = r.code; info.textContent = 'PASSO 1 PRONTO'; b1.disabled = false; b1.onclick = copyOf(ta1, b1);
      go.disabled = false;
    }, (e) => { info.className = 'hot'; info.textContent = 'ERRO AO GERAR: ' + String((e && e.message) || e).slice(0, 60); });
    go.onclick = async () => {
      if (!inv || finished) return;
      try { await inv.finish(ta2.value); finished = true; t0 = Date.now(); go.disabled = true; status.className = ''; status.textContent = 'CONECTANDO...'; }
      catch (e) { status.className = 'hot'; status.textContent = 'RESPOSTA INVÁLIDA: ' + String((e && e.message) || e).slice(0, 50); }
    };
    timer = setInterval(() => {
      if (!finished) return;
      const s = p2p.state();
      if (s === 'open') { clearInterval(timer); timer = null; status.className = 'ok'; status.textContent = 'AMIGO CONECTADO!'; setTimeout(() => { close(); if (hooks.onClose) hooks.onClose(); }, 900); return; }
      status.className = s === 'failed' ? 'hot' : ''; status.textContent = stateText(s) + (s === 'connecting' || s === 'new' ? ' ' + Math.floor((Date.now() - t0) / 1000) + 'S' : '');
      if (Date.now() - t0 > 25000 && s !== 'connected') { status.className = 'hot'; status.textContent += ' | DEMORANDO: A REDE PODE ESTAR BLOQUEANDO'; }
    }, 300);
  }

  // ---------- convidado ----------
  function join(p2p, hooks) {
    hooks = hooks || {};
    const inner = shell('ENTRAR COM CÓDIGO');
    const ta1 = el('textarea', { placeholder: 'COLE AQUI O CONVITE DO ANFITRIÃO' });
    const make = el('button', { textContent: 'GERAR RESPOSTA' });
    const cancel = el('button', { className: 'gr', textContent: 'CANCELAR', onclick: () => { close(); if (hooks.onCancel) hooks.onCancel(); } });
    const ta2 = el('textarea', { readOnly: true, placeholder: 'A RESPOSTA APARECE AQUI' });
    const b2 = el('button', { textContent: 'COPIAR RESPOSTA', disabled: true });
    const row2 = el('div', { className: 'row' }, [b2]);
    const status = el('p', { textContent: '' });
    inner.appendChild(el('label', { textContent: '1. COLE O CONVITE QUE VOCÊ RECEBEU' })); inner.appendChild(ta1);
    inner.appendChild(el('div', { className: 'row' }, [make, cancel]));
    inner.appendChild(el('label', { textContent: '2. MANDE A RESPOSTA DE VOLTA PARA O ANFITRIÃO' })); inner.appendChild(ta2); inner.appendChild(row2); inner.appendChild(status);
    const shr = shareOf(ta2); if (shr) row2.appendChild(shr);
    let made = false, t0 = 0;
    make.onclick = async () => {
      if (made) return;
      status.className = ''; status.textContent = 'GERANDO...';
      try {
        const ans = await p2p.accept(ta1.value);
        made = true; t0 = Date.now(); ta2.value = ans; b2.disabled = false; b2.onclick = copyOf(ta2, b2); make.disabled = true;
        status.textContent = 'AGORA ESPERE O ANFITRIÃO COLAR A RESPOSTA...';
        timer = setInterval(() => {
          const s = p2p.state();
          status.className = s === 'failed' ? 'hot' : ''; status.textContent = 'AGUARDANDO O ANFITRIÃO CONECTAR: ' + stateText(s) + ' ' + Math.floor((Date.now() - t0) / 1000) + 'S';
          if (s === 'failed') { status.className = 'hot'; status.textContent = 'NÃO CONECTOU: A REDE PODE BLOQUEAR CONEXÃO DIRETA. TENTEM OUTRA REDE (WI-FI).'; }
        }, 300);
      } catch (e) { status.className = 'hot'; status.textContent = 'CONVITE INVÁLIDO: ' + String((e && e.message) || e).slice(0, 50); }
    };
  }

  DP.p2pui = { invite, join, close, isOpen: () => !!box };
})(typeof window !== 'undefined' ? window : globalThis);
