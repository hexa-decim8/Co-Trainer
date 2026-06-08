import Foundation
import Combine

@MainActor
final class SessionViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    @Published var plans: [PracticePlanSummary] = []
    @Published var errorMessage: String?

    private let tokenStore: TokenStoring
    private let authService: AuthService
    private let planService: PlanService
    private let planCache: PlanCacheStore

    init() {
        let tokenStore = KeychainTokenStore()
        let apiClient = APIClient()

        self.tokenStore = tokenStore
        self.authService = AuthService(apiClient: apiClient, tokenStore: tokenStore)
        self.planService = PlanService(apiClient: apiClient, tokenStore: tokenStore)
        self.planCache = PlanCacheStore()
        self.plans = planCache.load()
    }

    func restoreSessionIfPossible() async {
        do {
            let user = try await authService.getCurrentUser()
            currentUser = user
            isAuthenticated = true
            try await refreshPlans()
        } catch {
            isAuthenticated = false
        }
    }

    func login(email: String, password: String) async {
        do {
            let user = try await authService.login(LoginForm(email: email, password: password))
            currentUser = user
            isAuthenticated = true
            errorMessage = nil
            try await refreshPlans()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Login failed."
        }
    }

    func logout() {
        authService.logout()
        planCache.clear()
        currentUser = nil
        plans = []
        isAuthenticated = false
    }

    func refreshPlans() async throws {
        do {
            let response = try await planService.fetchPlans()
            plans = response.items
            planCache.save(response.items)
            errorMessage = nil
        } catch APIError.unauthorized {
            logout()
            throw APIError.unauthorized
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Failed to load plans."
            throw error
        }
    }

    func loadPlanDetail(id: Int) async throws -> PracticePlanDetail {
        try await planService.fetchPlanDetail(id: id)
    }
}
