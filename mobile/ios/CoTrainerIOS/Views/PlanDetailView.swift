import SwiftUI

struct PlanDetailView: View {
    @ObservedObject var sessionViewModel: SessionViewModel
    let planID: Int

    @State private var detail: PracticePlanDetail?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading plan...")
            } else if let detail {
                List {
                    Section("Overview") {
                        Text(detail.name)
                            .font(.headline)
                        Text("\(detail.totalDuration) total minutes")
                            .foregroundStyle(.secondary)
                        if let notes = detail.notes, !notes.isEmpty {
                            Text(notes)
                        }
                    }

                    Section("Timeline") {
                        ForEach(detail.timeline) { item in
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.drillID)
                                    .font(.subheadline)
                                Text("Start \(item.startTimeMinutes)m • Duration \(item.durationMinutes)m")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } else {
                Text(errorMessage ?? "Unable to load plan.")
                    .foregroundStyle(.red)
            }
        }
        .navigationTitle("Plan Details")
        .task {
            await loadDetail()
        }
    }

    private func loadDetail() async {
        isLoading = true
        defer { isLoading = false }

        do {
            detail = try await sessionViewModel.loadPlanDetail(id: planID)
            errorMessage = nil
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "Failed to load plan details."
        }
    }
}
