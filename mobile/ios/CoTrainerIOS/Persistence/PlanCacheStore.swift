import Foundation

final class PlanCacheStore {
    private let defaults = UserDefaults.standard
    private let plansKey = "ios.cached.plan.summaries"

    func save(_ plans: [PracticePlanSummary]) {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        if let data = try? encoder.encode(plans) {
            defaults.set(data, forKey: plansKey)
        }
    }

    func load() -> [PracticePlanSummary] {
        guard let data = defaults.data(forKey: plansKey) else {
            return []
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return (try? decoder.decode([PracticePlanSummary].self, from: data)) ?? []
    }

    func clear() {
        defaults.removeObject(forKey: plansKey)
    }
}
