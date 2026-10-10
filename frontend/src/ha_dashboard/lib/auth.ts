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
    } else if (proxyRes.status === 400 || proxyRes.status === 401) {
      const errData: HAAuthResponse = await proxyRes.json().catch(() => ({}))
      if (errData.error === 'invalid_grant' || proxyRes.status === 401) {
        throw new Error('Tên đăng nhập hoặc mật khẩu HASS OS không chính xác!')
      }
      throw new Error(errData.error_description || 'Đăng nhập không thành công, vui lòng kiểm tra lại!')
    } else if (proxyRes.status !== 404 && proxyRes.status !== 405) {
      const errData: HAAuthResponse = await proxyRes.json().catch(() => ({}))
      throw new Error(
        errData.error_description || ('Không thể kết nối đến Home Assistant (' + proxyRes.status + ')')
      )
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
  const tokenUrl = proto + '://' + cleanHost + '/auth/token'

  const params = new URLSearchParams()
  params.append('grant_type', 'password')
  params.append('username', username)
  params.append('password', password)
  params.append('client_id', window.location.origin)

  try {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const data: HAAuthResponse = await res.json()

    if (!res.ok || data.error) {
      if (data.error === 'invalid_grant') {
        throw new Error('Tên đăng nhập hoặc mật khẩu HASS OS không chính xác!')
      }
      throw new Error(data.error_description || ('Lỗi đăng nhập (' + res.status + '): ' + data.error))
    }

    if (!data.access_token) {
      throw new Error('Không nhận được mã xác thực (access token) từ Home Assistant!')
    }

    return data.access_token
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes('Failed to fetch')) {
        throw new Error(
          'Không thể kết nối đến Home Assistant tại ' + cleanHost + '. Hãy kiểm tra địa chỉ IP và kết nối mạng!'
        )
      }
      throw err
    }
    throw new Error('Đăng nhập thất bại!')
  }
}
