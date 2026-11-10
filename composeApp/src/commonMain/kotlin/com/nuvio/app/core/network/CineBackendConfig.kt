package com.nuvio.app.core.network

object CineBackendConfig {
    /**
     * Domínio de Produção na Vercel (HTTPS) conectado ao Supabase e Mercado Pago.
     */
    const val VERCEL_API_URL = "https://cine-ultimatefree-seven.vercel.app"

    val baseUrl: String
        get() = VERCEL_API_URL.trim().removeSuffix("/").ifBlank { "http://10.0.2.2:3333" }
}
