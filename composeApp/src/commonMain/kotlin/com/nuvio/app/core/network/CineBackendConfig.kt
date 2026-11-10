package com.nuvio.app.core.network

object CineBackendConfig {
    /**
     * Insira aqui o seu domínio da Vercel após fazer o deploy
     * Exemplo: "https://seu-projeto.vercel.app"
     * 
     * Se deixado em branco, utiliza o fallback local do emulador Android (http://10.0.2.2:3333).
     */
    const val VERCEL_API_URL = ""

    val baseUrl: String
        get() = VERCEL_API_URL.trim().removeSuffix("/").ifBlank { "http://10.0.2.2:3333" }
}

