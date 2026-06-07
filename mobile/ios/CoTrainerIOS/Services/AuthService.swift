import Foundation

protocol TokenStoring {
    func getToken() -> String?
    func setToken(_ token: String)
    func clearToken()
}

final class InMemoryTokenStore: TokenStoring {
    private var token: String?

    func getToken() -> String? { token }
    func setToken(_ token: String) { self.token = token }
    func clearToken() { token = nil }
}

final class AuthService {
    private let apiClient: APIClient
    private let tokenStore: TokenStoring

    init(apiClient: APIClient, tokenStore: TokenStoring) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
    }

    func login(_ form: LoginForm) async throws -> User {
        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent("api/auth/login"))
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")

        let body = "username=\(form.email.urlEscaped)&password=\(form.password.urlEscaped)"
        request.httpBody = body.data(using: .utf8)

        let response: LoginResponse = try await apiClient.request(request, as: LoginResponse.self)
        tokenStore.setToken(response.accessToken)
        return response.user
    }

    func getCurrentUser() async throws -> User {
        guard let token = tokenStore.getToken() else {
            throw APIError.unauthorized
        }

        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent("api/auth/me"))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return try await apiClient.request(request, as: User.self)
    }

    func logout() {
        tokenStore.clearToken()
    }
}

private extension String {
    var urlEscaped: String {
        addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? self
    }
}
