/**
 * Glass Card Component - Helix iOS
 * Reusable glass morphism card with glow effect
 */

import SwiftUI

struct GlassCard<Content: View>: View {
    let content: Content
    var backgroundColor: Color = Color(hex: "111111").opacity(0.3)
    var borderColor: Color = Color.white.opacity(0.1)
    var glowColor: Color = Color(hex: "0686D4").opacity(0.2)
    var showGlow: Bool = true

    init(
        backgroundColor: Color = Color(hex: "111111").opacity(0.3),
        borderColor: Color = Color.white.opacity(0.1),
        glowColor: Color = Color(hex: "0686D4").opacity(0.2),
        showGlow: Bool = true,
        @ViewBuilder content: () -> Content
    ) {
        self.backgroundColor = backgroundColor
        self.borderColor = borderColor
        self.glowColor = glowColor
        self.showGlow = showGlow
        self.content = content()
    }

    var body: some View {
        ZStack {
            if showGlow {
                RoundedRectangle(cornerRadius: 12)
                    .fill(glowColor)
                    .blur(radius: 20)
            }

            RoundedRectangle(cornerRadius: 12)
                .fill(backgroundColor)

            VStack {
                content
            }
            .padding(16)
        }
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(borderColor, lineWidth: 1)
        )
    }
}

// Convenience initializer for common patterns
struct GlassCardWithIcon<Content: View>: View {
    let icon: String
    let title: String
    let content: Content
    var iconColor: Color = Color(hex: "0686D4")

    init(
        icon: String,
        title: String,
        iconColor: Color = Color(hex: "0686D4"),
        @ViewBuilder content: () -> Content
    ) {
        self.icon = icon
        self.title = title
        self.iconColor = iconColor
        self.content = content()
    }

    var body: some View {
        GlassCard {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    Image(systemName: icon)
                        .font(.system(size: 20))
                        .foregroundColor(iconColor)

                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)

                    Spacer()
                }

                content
            }
        }
    }
}

#if DEBUG
#Preview {
    VStack(spacing: 16) {
        GlassCard {
            VStack(spacing: 8) {
                Text("Simple Card")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(.white)

                Text("This is a glass morphism card")
                    .font(.system(size: 14))
                    .foregroundColor(Color(hex: "a1a1aa"))
            }
        }

        GlassCardWithIcon(icon: "sparkles", title: "Feature") {
            Text("Card with icon")
                .font(.system(size: 14))
                .foregroundColor(Color(hex: "a1a1aa"))
        }
    }
    .padding()
    .background(Color(hex: "0a0a0a"))
    .preferredColorScheme(.dark)
}
#endif
