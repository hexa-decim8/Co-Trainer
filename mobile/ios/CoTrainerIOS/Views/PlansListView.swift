import SwiftUI

struct PlansListView: View {
    @ObservedObject var sessionViewModel: SessionViewModel

    var body: some View {
        NavigationStack {
            List(sessionViewModel.plans) { plan in
                NavigationLink(value: plan.id) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(plan.name)
                            .font(.headline)

                        Text("\(plan.drillCount) drills • \(plan.totalDuration) min")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("Practice Plans")
            .navigationDestination(for: Int.self) { planID in
                PlanDetailView(sessionViewModel: sessionViewModel, planID: planID)
            }
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Logout") {
                        sessionViewModel.logout()
                    }
                }

                ToolbarItem(placement: .topBarTrailing) {
                    Button("Refresh") {
                        Task {
                            try? await sessionViewModel.refreshPlans()
                        }
                    }
                }
            }
            .refreshable {
                try? await sessionViewModel.refreshPlans()
            }
        }
    }
}
