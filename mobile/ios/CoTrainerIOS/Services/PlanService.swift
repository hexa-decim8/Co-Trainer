import Foundation

final class PlanService {
    private let apiClient: APIClient
    private let tokenStore: TokenStoring

    init(apiClient: APIClient, tokenStore: TokenStoring) {
        self.apiClient = apiClient
        self.tokenStore = tokenStore
    }

    func fetchPlans(page: Int = 1, pageSize: Int = 20) async throws -> PaginatedPlansResponse {
        guard let token = tokenStore.getToken() else {
            throw APIError.unauthorized
        }

        var components = URLComponents(url: AppConfig.baseURL.appendingPathComponent("api/plans"), resolvingAgainstBaseURL: false)
        components?.queryItems = [
            URLQueryItem(name: "page", value: String(page)),
            URLQueryItem(name: "page_size", value: String(pageSize))
        ]

        guard let url = components?.url else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return try await apiClient.request(request, as: PaginatedPlansResponse.self)
    }

    func fetchPlanDetail(id: Int) async throws -> PracticePlanDetail {
        guard let token = tokenStore.getToken() else {
            throw APIError.unauthorized
        }

        var request = URLRequest(url: AppConfig.baseURL.appendingPathComponent("api/plans/\(id)"))
        request.httpMethod = "GET"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        return try await apiClient.request(request, as: PracticePlanDetail.self)
    }
}
