import SwiftUI

/// Calendar Intelligence Features for iOS
/// Integrates meeting prep and time suggestion operations into calendar workflow
struct CalendarIntelligenceView: View {
  @StateObject private var viewModel = CalendarIntelligenceViewModel()
  @State private var selectedMeeting: CalendarEvent?

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        // Header with operation toggles
        OperationHeaderView(
          operations: viewModel.calendarOperations,
          onToggle: viewModel.toggleOperation
        )

        TabView(selection: $viewModel.selectedTab) {
          // Meeting Prep Tab
          MeetingPrepTabView(viewModel: viewModel)
            .tag(CalendarIntelligenceTab.prep)

          // Time Suggestion Tab
          TimeSuggestionTabView(viewModel: viewModel)
            .tag(CalendarIntelligenceTab.timeSuggestion)
        }
        .tabViewStyle(.page(indexDisplayMode: .always))
      }
      .navigationTitle("Calendar Intelligence")
      .navigationBarTitleDisplayMode(.inline)
      .onAppear {
        viewModel.loadOperations()
      }
    }
  }
}

// MARK: - Meeting Prep Tab
struct MeetingPrepTabView: View {
  @ObservedObject var viewModel: CalendarIntelligenceViewModel
  @State private var showPrepChecklist = false

  var body: some View {
    VStack(spacing: 16) {
      Text("Meeting Preparation")
        .font(.headline)
        .padding(.horizontal)

      if viewModel.upcomingMeetings.isEmpty {
        VStack(spacing: 12) {
          Image(systemName: "calendar")
            .font(.system(size: 48))
            .foregroundColor(.gray)
          Text("No upcoming meetings")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      } else {
        List(viewModel.upcomingMeetings, id: \.id) { meeting in
          VStack(alignment: .leading, spacing: 12) {
            HStack {
              VStack(alignment: .leading, spacing: 4) {
                Text(meeting.title)
                  .font(.subheadline)
                  .fontWeight(.semibold)

                Text(formatted(meeting.startTime))
                  .font(.caption)
                  .foregroundColor(.secondary)
              }

              Spacer()

              if meeting.minutesToStart <= 15 {
                HStack(spacing: 4) {
                  Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(.orange)
                  Text("Soon")
                    .font(.caption2)
                    .fontWeight(.semibold)
                }
              }
            }

            if let prep = viewModel.preparationData[meeting.id] {
              PrepChecklistView(prep: prep)

              Button(action: {
                viewModel.generatePrepGuidance(for: meeting)
              }) {
                Label("Refresh Guidance", systemImage: "arrow.clockwise")
                  .frame(maxWidth: .infinity)
              }
              .buttonStyle(.bordered)
            } else {
              Button(action: {
                viewModel.generatePrepGuidance(for: meeting)
              }) {
                if viewModel.isLoading {
                  ProgressView()
                    .frame(maxWidth: .infinity)
                } else {
                  Label("Generate Prep", systemImage: "sparkles")
                    .frame(maxWidth: .infinity)
                }
              }
              .buttonStyle(.borderedProminent)
            }
          }
          .padding(.vertical, 8)
        }
      }

      if let error = viewModel.error {
        Text(error)
          .font(.caption)
          .foregroundColor(.red)
          .padding(.horizontal)
      }

      Spacer()
    }
    .padding(.vertical)
  }

  private func formatted(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}

// MARK: - Time Suggestion Tab
struct TimeSuggestionTabView: View {
  @ObservedObject var viewModel: CalendarIntelligenceViewModel
  @State private var attendeeInput = ""
  @State private var dateRange = DateRange(start: Date(), end: Date().addingTimeInterval(7 * 24 * 3600))

  var body: some View {
    VStack(spacing: 16) {
      Text("Find Meeting Times")
        .font(.headline)
        .padding(.horizontal)

      Form {
        Section("Attendees") {
          TextField("Enter email addresses (comma-separated)", text: $attendeeInput)
        }

        Section("Date Range") {
          DatePicker("From", selection: $dateRange.start, displayedComponents: .date)
          DatePicker("To", selection: $dateRange.end, displayedComponents: .date)
        }
      }

      // Suggested Times
      if !viewModel.suggestedTimes.isEmpty {
        VStack(alignment: .leading, spacing: 12) {
          Text("Recommended Times")
            .font(.headline)
            .padding(.horizontal)

          List(viewModel.suggestedTimes, id: \.id) { suggestion in
            VStack(alignment: .leading, spacing: 8) {
              HStack {
                VStack(alignment: .leading) {
                  Text(formatted(suggestion.dateTime))
                    .font(.subheadline)
                    .fontWeight(.semibold)

                  Text("Quality: \(Int(suggestion.qualityScore))%")
                    .font(.caption)
                    .foregroundColor(.secondary)
                }

                Spacer()

                QualityIndicator(score: suggestion.qualityScore)
              }

              if let reason = suggestion.reason {
                Text(reason)
                  .font(.caption)
                  .foregroundColor(.secondary)
              }

              Button(action: {
                viewModel.scheduleMeeting(at: suggestion.dateTime)
              }) {
                Label("Schedule", systemImage: "calendar.badge.plus")
                  .frame(maxWidth: .infinity)
              }
              .buttonStyle(.borderedProminent)
            }
            .padding(.vertical, 8)
          }
        }
      } else if !viewModel.isLoading {
        VStack(spacing: 12) {
          Image(systemName: "clock")
            .font(.system(size: 48))
            .foregroundColor(.gray)
          Text("No times suggested yet")
            .font(.subheadline)
            .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 40)
      }

      // Find Times Button
      Button(action: {
        let attendees = attendeeInput
          .split(separator: ",")
          .map { $0.trimmingCharacters(in: .whitespaces) }
        viewModel.suggestMeetingTimes(
          attendees: attendees,
          dateRange: dateRange
        )
      }) {
        if viewModel.isLoading {
          ProgressView()
            .frame(maxWidth: .infinity)
        } else {
          Label("Find Times", systemImage: "sparkles")
            .frame(maxWidth: .infinity)
        }
      }
      .buttonStyle(.borderedProminent)
      .disabled(
        !viewModel.isOperationEnabled("calendar-time") || attendeeInput.isEmpty
      )
      .padding(.horizontal)

      if let error = viewModel.error {
        Text(error)
          .font(.caption)
          .foregroundColor(.red)
          .padding(.horizontal)
      }

      Spacer()
    }
    .padding(.vertical)
  }

  private func formatted(_ date: Date) -> String {
    let formatter = DateFormatter()
    formatter.dateStyle = .short
    formatter.timeStyle = .short
    return formatter.string(from: date)
  }
}

// MARK: - Supporting Views
struct PrepChecklistView: View {
  let prep: MeetingPrepData

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Preparation")
        .font(.caption)
        .fontWeight(.semibold)
        .foregroundColor(.secondary)

      if let summary = prep.summary {
        VStack(alignment: .leading, spacing: 4) {
          Label("Summary", systemImage: "text.quote")
            .font(.caption2)
            .fontWeight(.semibold)

          Text(summary)
            .font(.caption)
            .lineLimit(3)
        }
      }

      if !prep.keyPoints.isEmpty {
        VStack(alignment: .leading, spacing: 4) {
          Label("Key Points", systemImage: "checklist")
            .font(.caption2)
            .fontWeight(.semibold)

          VStack(alignment: .leading, spacing: 4) {
            ForEach(prep.keyPoints.prefix(3), id: \.self) { point in
              HStack(spacing: 8) {
                Image(systemName: "circle.fill")
                  .font(.system(size: 4))
                Text(point)
                  .font(.caption)
              }
            }
          }
        }
      }

      if !prep.suggestedTopics.isEmpty {
        VStack(alignment: .leading, spacing: 4) {
          Label("Topics", systemImage: "bubble.right")
            .font(.caption2)
            .fontWeight(.semibold)

          Text(prep.suggestedTopics.prefix(3).joined(separator: ", "))
            .font(.caption)
            .lineLimit(2)
        }
      }
    }
    .padding(12)
    .background(Color(.systemBackground))
    .cornerRadius(8)
  }
}

struct QualityIndicator: View {
  let score: Double

  var color: Color {
    if score >= 80 {
      return .green
    } else if score >= 60 {
      return .yellow
    } else {
      return .red
    }
  }

  var body: some View {
    HStack(spacing: 4) {
      ZStack {
        Circle()
          .fill(Color.gray.opacity(0.2))

        Circle()
          .trim(from: 0, to: score / 100)
          .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round))
          .rotationEffect(.degrees(-90))

        Text("\(Int(score))")
          .font(.caption2)
          .fontWeight(.semibold)
      }
      .frame(width: 32, height: 32)
    }
  }
}

struct OperationHeaderView: View {
  let operations: [String: Bool]
  let onToggle: (String) -> Void

  var body: some View {
    VStack(spacing: 0) {
      Divider()

      ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 8) {
          ForEach(Array(operations.keys), id: \.self) { op in
            HStack(spacing: 4) {
              Circle()
                .fill(operations[op] ?? false ? Color.green : Color.gray)
                .frame(width: 6)

              Text(op.replacingOccurrences(of: "calendar-", with: ""))
                .font(.caption)
                .fontWeight(.semibold)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(.systemBackground))
            .cornerRadius(16)
            .onTapGesture {
              onToggle(op)
            }
          }
        }
        .padding(.horizontal)
      }

      Divider()
    }
    .padding(.vertical, 8)
  }
}

// MARK: - View Model
@MainActor
class CalendarIntelligenceViewModel: ObservableObject {
  @Published var selectedTab: CalendarIntelligenceTab = .prep
  @Published var isLoading = false
  @Published var error: String?
  @Published var calendarOperations: [String: Bool] = [:]
  @Published var upcomingMeetings: [CalendarEvent] = []
  @Published var preparationData: [UUID: MeetingPrepData] = [:]
  @Published var suggestedTimes: [TimeSuggestion] = []

  private let calendarService = CalendarIntelligenceService()

  func loadOperations() {
    Task {
      do {
        let operations = try await calendarService.getOperations()
        self.calendarOperations = Dictionary(
          uniqueKeysWithValues: operations.map { ($0, true) }
        )
        await loadUpcomingMeetings()
      } catch {
        self.error = "Failed to load operations: \(error.localizedDescription)"
      }
    }
  }

  func toggleOperation(_ operation: String) {
    calendarOperations[operation]?.toggle()
  }

  func isOperationEnabled(_ operation: String) -> Bool {
    return calendarOperations[operation] ?? false
  }

  private func loadUpcomingMeetings() async {
    do {
      let meetings = try await calendarService.getUpcomingMeetings()
      self.upcomingMeetings = meetings
    } catch {
      self.error = "Failed to load meetings: \(error.localizedDescription)"
    }
  }

  func generatePrepGuidance(for meeting: CalendarEvent) {
    isLoading = true
    error = nil

    Task {
      do {
        let prep = try await calendarService.prepareMeeting(
          eventId: meeting.id.uuidString
        )
        self.preparationData[meeting.id] = prep
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func suggestMeetingTimes(
    attendees: [String],
    dateRange: DateRange
  ) {
    isLoading = true
    error = nil

    Task {
      do {
        let suggestions = try await calendarService.suggestMeetingTimes(
          attendees: attendees,
          startDate: dateRange.start,
          endDate: dateRange.end
        )
        self.suggestedTimes = suggestions
        self.isLoading = false
      } catch {
        self.error = error.localizedDescription
        self.isLoading = false
      }
    }
  }

  func scheduleMeeting(at dateTime: Date) {
    Task {
      do {
        try await calendarService.createMeeting(at: dateTime)
        self.suggestedTimes.removeAll()
        self.error = nil
      } catch {
        self.error = "Failed to schedule meeting: \(error.localizedDescription)"
      }
    }
  }
}

// MARK: - Models
enum CalendarIntelligenceTab: Hashable {
  case prep
  case timeSuggestion
}

struct CalendarEvent: Identifiable, Codable {
  let id: UUID
  let title: String
  let startTime: Date
  let endTime: Date
  let attendees: [String]
  let description: String?

  var minutesToStart: Int {
    Int(startTime.timeIntervalSinceNow / 60)
  }
}

struct MeetingPrepData: Codable {
  let summary: String?
  let keyPoints: [String]
  let suggestedTopics: [String]
  let preparationEstimate: Int // minutes
}

struct TimeSuggestion: Identifiable, Codable {
  let id: UUID
  let dateTime: Date
  let qualityScore: Double // 0-100
  let reason: String?
  let attendeeAvailability: Double // percentage
}

struct DateRange {
  var start: Date
  var end: Date
}

#Preview {
  CalendarIntelligenceView()
}
