import { useState, useEffect, useRef } from 'react';

export function useDidCommSocket(did, mediatorUrl) {
  const [messages, setMessages] = useState([]);
  const ws = useRef(null);

  useEffect(() => {
    if (!did || !mediatorUrl) return;

    const socketUrl = mediatorUrl.replace(/^http/, 'ws');
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      console.log(`[Holder] WebSocket connected. Subscribing with DID: ${did}`);
      ws.current.send(JSON.stringify({ type: 'subscribe', did }));
    };

    ws.current.onmessage = (event) => {
      const incomingMessages = JSON.parse(event.data);
      if (Array.isArray(incomingMessages) && incomingMessages.length > 0) {
        console.log("[Holder] Received messages via WebSocket:", incomingMessages);
        setMessages(prev => [...prev, ...incomingMessages]);
      }
    };

    ws.current.onclose = () => console.log('[Holder] WebSocket disconnected.');
    ws.current.onerror = (err) => console.error('[Holder] WebSocket error:', err);

    return () => {
      if (ws.current) ws.current.close();
    };
  }, [did, mediatorUrl]);

  return { messages, setMessages };
}