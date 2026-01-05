const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function apiFetch(input: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE_URL}${input}`, {
    ...init,
    credentials: 'include', // ВАЖНО: чтобы отправлять cookies
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!res.ok) {
    // Можно выкидывать ошибку с текстом
    const text = await res.text();
    let errorMessage = text || `Request failed with ${res.status}`;
    
    try {
      const json = JSON.parse(text);
      errorMessage = json.message || errorMessage;
    } catch {
      // Не JSON, используем текст как есть
    }
    
    throw new Error(errorMessage);
  }

  if (res.status === 204) return null;
  return res.json();
}



























