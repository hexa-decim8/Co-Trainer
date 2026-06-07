import SwiftUI

@main
struct CoTrainerIOSApp: App {
    @StateObject private var sessionViewModel = SessionViewModel()

    var body: some Scene {
        WindowGroup {
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
}
