import OpenClawChatUI
import OpenClawKit
import SwiftUI

struct ChatSheet: View {
    @Environment(\.dismiss) private var dismiss
    @State private var viewModel: OpenClawChatViewModel
    private let userAccent: Color

    init(gateway: GatewayNodeSession, sessionKey: String, userAccent: Color? = nil) {
        let transport = IOSGatewayChatTransport(gateway: gateway)
        self._viewModel = State(
            initialValue: OpenClawChatViewModel(
                sessionKey: sessionKey,
                transport: transport))
        self.userAccent = userAccent ?? .helixBlue
    }

    var body: some View {
        NavigationStack {
            OpenClawChatView(
                viewModel: self.viewModel,
                showsSessionSwitcher: true,
                userAccent: self.userAccent)
                .navigationTitle("Chat")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            self.dismiss()
                        } label: {
                            Image(systemName: "xmark")
                                .foregroundStyle(.textSecondary)
                        }
                        .accessibilityLabel("Close")
                    }
                }
                .toolbarBackground(.bgSecondary.opacity(0.9), for: .navigationBar)
                .toolbarBackground(.visible, for: .navigationBar)
        }
        .tint(.helixBlue)
    }
}
