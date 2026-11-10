package com.nuvio.app.features.auth

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.nuvio.app.features.addons.httpRequestRaw
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json

@Serializable
private data class CreatePixRequestDto(
    val name: String,
    val email: String,
    val phone: String,
)

@Serializable
private data class CreatePixPaymentDto(
    val paymentId: String = "",
    val status: String = "pending",
    val email: String = "",
    val name: String = "",
    val qrCode: String = "",
    val qrCodeBase64: String = "",
)

@Serializable
private data class CreatePixResponseDto(
    val ok: Boolean = false,
    val error: String? = null,
    val payment: CreatePixPaymentDto? = null,
)

@Serializable
private data class PixStatusResponseDto(
    val ok: Boolean = false,
    val status: String = "pending",
    val approved: Boolean = false,
    val email: String = "",
)

private val PixJson = Json { ignoreUnknownKeys = true; isLenient = true }

@Composable
internal fun MercadoPagoPixInlineSection(
    backendBaseUrl: String,
    prefillEmail: String,
    height: Dp,
    scale: Float,
    onPixApprovedForEmail: (email: String) -> Unit,
) {
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    var modalOpen by remember { mutableStateOf(false) }
    var name by remember { mutableStateOf("") }
    var email by remember(prefillEmail) { mutableStateOf(prefillEmail) }
    var phone by remember { mutableStateOf("") }
    var isSubmitting by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var activePayment by remember { mutableStateOf<CreatePixPaymentDto?>(null) }
    var isApproved by remember { mutableStateOf(false) }
    var copiedFeedback by remember { mutableStateOf(false) }

    val cleanBaseUrl = remember(backendBaseUrl) {
        backendBaseUrl.trim().removeSuffix("/").ifBlank { "http://10.0.2.2:3333" }
    }

    LaunchedEffect(activePayment?.paymentId, isApproved) {
        val payment = activePayment ?: return@LaunchedEffect
        if (isApproved || payment.paymentId.isBlank()) return@LaunchedEffect
        while (!isApproved) {
            delay(4500L)
            runCatching {
                val res = httpRequestRaw(
                    method = "GET",
                    url = "$cleanBaseUrl/api/pix/status?paymentId=${payment.paymentId}&email=${payment.email}",
                    headers = emptyMap(),
                    body = "",
                )
                if (res.status in 200..299) {
                    val parsed = PixJson.decodeFromString<PixStatusResponseDto>(res.body)
                    if (parsed.approved) {
                        isApproved = true
                        onPixApprovedForEmail(payment.email)
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
    ) {
        // O modal é gerado diretamente EM CIMA do botão clicado
        AnimatedVisibility(visible = modalOpen) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(bottom = 12.dp)
                    .clip(RoundedCornerShape(18.dp))
                    .background(Color(0xFF10141D))
                    .border(1.5.dp, Color(0xFF00BFA5), RoundedCornerShape(18.dp))
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        text = "⚡ PIX MERCADO PAGO • PLANO R$ 10,00",
                        color = Color(0xFF4DD0E1),
                        fontSize = (11f * scale).sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        text = "✕",
                        color = AuthTextSecondary,
                        fontSize = (14f * scale).sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.clickable { modalOpen = false },
                    )
                }

                when {
                    isApproved && activePayment != null -> {
                        Text(
                            text = "✅ Pagamento PIX Confirmado!",
                            color = Color(0xFF81C784),
                            fontSize = (15f * scale).sp,
                            fontWeight = FontWeight.Bold,
                        )
                        Text(
                            text = "Seu pagamento para ${activePayment?.email} foi aprovado! Crie sua senha acima usando este mesmo Gmail para liberar o aplicativo.",
                            color = AuthTextPrimary,
                            fontSize = (12.5f * scale).sp,
                            lineHeight = (17f * scale).sp,
                        )
                    }

                    activePayment != null -> {
                        val pay = activePayment!!
                        Text(
                            text = "PIX de R$ 10,00 gerado para ${pay.email}",
                            color = AuthTextPrimary,
                            fontSize = (13.5f * scale).sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(
                            text = "Copie o código PIX abaixo e pague no seu banco. Assim que aprovado, você criará sua conta no app usando este mesmo Gmail:",
                            color = AuthTextSecondary,
                            fontSize = (12f * scale).sp,
                            lineHeight = (16f * scale).sp,
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFF090B10))
                                .border(1.dp, AuthFieldBorder, RoundedCornerShape(10.dp))
                                .padding(10.dp),
                        ) {
                            Text(
                                text = pay.qrCode,
                                color = AuthTextPrimary,
                                fontSize = (11f * scale).sp,
                                maxLines = 2,
                            )
                        }
                        Button(
                            onClick = {
                                clipboard.setText(AnnotatedString(pay.qrCode))
                                copiedFeedback = true
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(44.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00BFA5),
                                contentColor = Color.White,
                            ),
                        ) {
                            Text(
                                text = if (copiedFeedback) "✓ Código PIX Copiado!" else "📋 Copiar Código PIX Copia e Cola",
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }

                    else -> {
                        Text(
                            text = "Use abaixo o mesmo Gmail que você usará para criar sua conta no aplicativo após o pagamento:",
                            color = AuthTextSecondary,
                            fontSize = (12f * scale).sp,
                            lineHeight = (16f * scale).sp,
                        )

                        PixInlineInputField(
                            value = name,
                            onValueChange = { name = it; errorMessage = null },
                            placeholder = "Seu Nome Completo",
                            scale = scale,
                        )
                        PixInlineInputField(
                            value = email,
                            onValueChange = { email = it; errorMessage = null },
                            placeholder = "Seu Gmail (será seu login no app)",
                            keyboardType = KeyboardType.Email,
                            scale = scale,
                        )
                        PixInlineInputField(
                            value = phone,
                            onValueChange = { phone = it; errorMessage = null },
                            placeholder = "Telefone / WhatsApp com DDD",
                            keyboardType = KeyboardType.Phone,
                            scale = scale,
                        )

                        errorMessage?.let { msg ->
                            Text(
                                text = msg,
                                color = MaterialTheme.colorScheme.error,
                                fontSize = (12f * scale).sp,
                            )
                        }

                        Button(
                            onClick = {
                                if (isSubmitting) return@Button
                                val cleanName = name.trim()
                                val cleanEmail = email.trim().lowercase()
                                val cleanPhone = phone.trim()
                                if (cleanName.length < 2) {
                                    errorMessage = "Informe seu nome completo."
                                    return@Button
                                }
                                if (!cleanEmail.contains("@") || !cleanEmail.contains(".")) {
                                    errorMessage = "Informe um Gmail válido."
                                    return@Button
                                }
                                if (cleanPhone.filter { it.isDigit() }.length < 8) {
                                    errorMessage = "Informe seu telefone com DDD."
                                    return@Button
                                }
                                isSubmitting = true
                                errorMessage = null
                                scope.launch {
                                    runCatching {
                                        val bodyJson = PixJson.encodeToString(
                                            CreatePixRequestDto(
                                                name = cleanName,
                                                email = cleanEmail,
                                                phone = cleanPhone,
                                            ),
                                        )
                                        val response = httpRequestRaw(
                                            method = "POST",
                                            url = "$cleanBaseUrl/api/pix/create",
                                            headers = mapOf("Content-Type" to "application/json"),
                                            body = bodyJson,
                                        )
                                        val parsed = PixJson.decodeFromString<CreatePixResponseDto>(response.body)
                                        if (!parsed.ok || parsed.payment == null) {
                                            error(parsed.error ?: "Erro ao gerar PIX no Mercado Pago.")
                                        }
                                        parsed.payment
                                    }.onSuccess { payment ->
                                        isSubmitting = false
                                        activePayment = payment
                                    }.onFailure { err ->
                                        isSubmitting = false
                                        errorMessage = err.message ?: "Falha ao conectar ao servidor PIX."
                                    }
                                }
                            },
                            enabled = !isSubmitting,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF00BFA5),
                                contentColor = Color.White,
                            ),
                        ) {
                            Text(
                                text = if (isSubmitting) "Gerando PIX..." else "⚡ Gerar PIX de R$ 10,00",
                                fontWeight = FontWeight.Bold,
                            )
                        }
                    }
                }
            }
        }

        AuthSecondaryButton(
            text = "⚡ Liberar Acesso — Plano R$ 10,00 (PIX)",
            enabled = true,
            height = height,
            scale = scale,
            onClick = { modalOpen = !modalOpen },
        )
    }
}

@Composable
private fun PixInlineInputField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    scale: Float,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    val shape = RoundedCornerShape(12.dp)
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp * scale)
            .background(Color.White.copy(alpha = 0.05f), shape)
            .border(1.dp, AuthFieldBorder, shape)
            .padding(horizontal = 14.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(
                text = placeholder,
                color = AuthTextSecondary,
                fontSize = (13.5f * scale).sp,
            )
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            textStyle = MaterialTheme.typography.bodyMedium.copy(
                color = AuthTextPrimary,
                fontSize = (14f * scale).sp,
            ),
            cursorBrush = SolidColor(AuthTextPrimary),
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

