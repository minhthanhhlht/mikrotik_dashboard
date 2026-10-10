export interface UserCredentials {
  host: string
  username: string
  password: string
  useTls?: boolean
}

interface HAAuthResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  error?: string
  error_description?: string
}

export async function authenticateWithCredentials(creds: UserCredentials): Promise<string> {
  const { host, username, password, useTls } = creds

  if (!host || !username || !password) {
    throw new Error('Vui lòng nhập đầy đủ Host, Username và Mật khẩu!')
  }

  try {
    const proxyRes = await fetch('/api/ha-auth-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host,
        username,
        password,
        useTls,
      }),
    })

    if (proxyRes.ok) {
      const data: HAAuthResponse = await proxyRes.json()
      if (data.access_token) {
        return data.access_token
      }
      if (data.error_description || data.error) {
        throw new Error(data.error_description || ('Lỗi đăng nhập: ' + data.error))
      }
    } else {
      const errData: HAAuthResponse = await proxyRes.json().catch(() => ({}))
      if (errData.error === 'invalid_grant' || proxyRes.status === 401) {
        throw new Error('Tên đăng nhập hoặc mật khẩu HASS OS không chính xác!')
      }
      if (errData.error_description) {
        throw new Error(errData.error_description)
      }
    }
  } catch (err) {
    if (
      err instanceof Error &&
      !err.message.includes('404') &&
      !err.message.includes('Failed to fetch')
    ) {
      throw err
    }
  }

  const cleanHost = host.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  const proto = useTls || host.startsWith('https://') ? 'https' : 'http'
  const baseUrl = `${proto}://${cleanHost}`
  const clientId = `${window.location.origin}/`

  try {
    const flowRes = await fetch(`${baseUrl}/auth/login_flow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        handler: ['homeassistant', null],
        redirect_uri: `${window.location.origin}/?auth_callback=1`,
      }),
    })

    if (!flowRes.ok) {
      throw new Error(`Không thể kết nối đến Home Assistant Auth (${flowRes.status})`)
    }

    const flowData = (await flowRes.json()) as { flow_id?: string }
    const flowId = flowData.flow_id
    if (!flowId) {
      throw new Error('Không nhận được flow_id từ Home Assistant')
    }

    const stepRes = await fetch(`${baseUrl}/auth/login_flow/${flowId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        username,
        password,
      }),
    })

    const stepData = (await stepRes.json()) as {
      type?: string
      result?: string
      errors?: Record<string, string>
    }

    if (stepData.type === 'form' && stepData.errors) {
      throw new Error('Tên đăng nhập hoặc mật khẩu HASS OS không chính xác!')
    }

    if (stepData.type !== 'create_entry' || !stepData.result) {
      throw new Error(stepData.errors?.base || 'Đăng nhập không thành công!')
    }

    const authCode = stepData.result

    const tokenParams = new URLSearchParams()
    tokenParams.append('grant_type', 'authorization_code')
    tokenParams.append('code', authCode)
    tokenParams.append('client_id', clientId)

    const tokenRes = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })

    const tokenData: HAAuthResponse = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || 'Không lấy được access token từ HASS')
    }

    return tokenData.access_token
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    throw new Error(errorMsg)
  }
}
