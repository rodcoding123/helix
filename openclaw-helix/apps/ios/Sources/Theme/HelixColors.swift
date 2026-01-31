import SwiftUI

// MARK: - Helix Void Pulse Color Palette

extension Color {
    // Primary brand colors
    static let helixBlue = Color(hex: 0x0686D4)
    static let helixBlueDark = Color(hex: 0x0573B8)
    static let helixBlueLight = Color(hex: 0x38A3E0)

    // Accent purple
    static let accentPurple = Color(hex: 0x7234ED)
    static let accentPurpleDark = Color(hex: 0x5F2AD0)
    static let accentPurpleLight = Color(hex: 0x9358FF)

    // Void backgrounds
    static let void = Color(hex: 0x050505)
    static let bgPrimary = Color(hex: 0x0A0A0A)
    static let bgSecondary = Color(hex: 0x111111)
    static let bgTertiary = Color(hex: 0x1A1A1A)

    // Text colors
    static let textPrimary = Color(hex: 0xFAFAFA)
    static let textSecondary = Color(hex: 0xA1A1AA)
    static let textTertiary = Color(hex: 0x71717A)

    // Status colors
    static let statusSuccess = Color(hex: 0x10B981)
    static let statusWarning = Color(hex: 0xF59E0B)
    static let statusDanger = Color(hex: 0xEF4444)

    // Gradient colors
    static let gradientHelixStart = Color(hex: 0x0686D4)
    static let gradientHelixEnd = Color(hex: 0x7234ED)

    // Convenience initializer for hex colors
    init(hex: UInt, alpha: Double = 1.0) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: alpha
        )
    }
}

// MARK: - Helix Gradient

extension LinearGradient {
    static let helixGradient = LinearGradient(
        colors: [.helixBlue, .accentPurple],
        startPoint: .leading,
        endPoint: .trailing
    )

    static let helixGradientVertical = LinearGradient(
        colors: [.helixBlue, .accentPurple],
        startPoint: .top,
        endPoint: .bottom
    )

    static let voidGradient = LinearGradient(
        colors: [.void, .bgPrimary],
        startPoint: .top,
        endPoint: .bottom
    )
}

// MARK: - Helix Button Styles

struct HelixPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                LinearGradient.helixGradient
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: .helixBlue.opacity(0.3), radius: 8, y: 4)
    }
}

struct HelixSecondaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(.textPrimary)
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.bgTertiary)
                    .opacity(configuration.isPressed ? 0.8 : 1.0)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.1), lineWidth: 1)
            )
    }
}

// MARK: - Helix Card Modifier

struct HelixCardModifier: ViewModifier {
    var isGlass: Bool = false

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(isGlass ? Color.bgSecondary.opacity(0.6) : Color.bgSecondary)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.05), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.2), radius: 10, y: 5)
    }
}

extension View {
    func helixCard(isGlass: Bool = false) -> some View {
        modifier(HelixCardModifier(isGlass: isGlass))
    }
}

// MARK: - Helix Status Colors

enum HelixStatus {
    case success
    case warning
    case error
    case inactive

    var color: Color {
        switch self {
        case .success: return .statusSuccess
        case .warning: return .statusWarning
        case .error: return .statusDanger
        case .inactive: return .textTertiary
        }
    }
}
