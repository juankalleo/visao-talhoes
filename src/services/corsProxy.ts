/**
 * CORS Proxy para requisições ao Copernicus
 * Contorna restrições CORS fazendo requisições no servidor Node.js
 */

export async function fetchWithCorsProxy(url: string, options?: RequestInit): Promise<Response> {
  try {
    // Se estamos em desenvolvimento, usar um proxy CORS público como fallback
    const proxyUrl = `https://cors-anywhere.herokuapp.com/${url}`;
    
    const response = await fetch(proxyUrl, {
      ...options,
      headers: {
        ...options?.headers,
        'X-Requested-With': 'XMLHttpRequest',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } catch (error) {
    console.error('CORS Proxy Error:', error);
    throw error;
  }
}

/**
 * Wrapper para fetch com tratamento de CORS
 * Tenta requisição normal primeiro, depois com proxy se falhar
 */
export async function fetchWithFallback(url: string, options?: RequestInit): Promise<Response> {
  try {
    // Tenta requisição direta primeiro
    return await fetch(url, options);
  } catch (directError) {
    console.warn('Direct fetch failed, trying CORS proxy...', directError);
    
    // Se falhar, tenta com proxy
    try {
      return await fetchWithCorsProxy(url, options);
    } catch (proxyError) {
      console.error('Both direct and proxy requests failed', proxyError);
      throw new Error('Não foi possível buscar dados. Verifique sua conexão.');
    }
  }
}
