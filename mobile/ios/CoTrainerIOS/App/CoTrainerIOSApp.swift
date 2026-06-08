import SwiftUI

struct CoTrainerIOSRootView: View {
    @StateObject private var sessionViewModel = SessionViewModel()

    var body: some View {
        Group {
            if sessionViewModel.isAuthenticated {
                PlansListView(sessionViewModel: sessionViewModel)
            } else {
                LoginView(sessionViewModel: sessionViewModel)
            }
        }
        .task {
            await sessionViewModel.restoreSessionIfPossible()
        }
    }
}
