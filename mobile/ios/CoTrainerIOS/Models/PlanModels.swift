import Foundation

struct PaginatedPlansResponse: Decodable {
    let items: [PracticePlanSummary]
    let total: Int
    let page: Int
    let pageSize: Int
    let totalPages: Int

    enum CodingKeys: String, CodingKey {
        case items
        case total
        case page
        case pageSize = "page_size"
        case totalPages = "total_pages"
    }
}

struct PracticePlanSummary: Codable, Identifiable {
    let id: Int
    let name: String
    let date: Date?
    let practiceType: String
    let isTemplate: Bool
    let isPublic: Bool
    let totalDuration: Int
    let drillCount: Int

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case date
        case practiceType = "practice_type"
        case isTemplate = "is_template"
        case isPublic = "is_public"
        case totalDuration = "total_duration"
        case drillCount = "drill_count"
    }
}

struct PracticePlanDetail: Decodable {
    let id: Int
    let name: String
    let notes: String?
    let totalDuration: Int
    let timeline: [TimelineItem]

    enum CodingKeys: String, CodingKey {
        case id
        case name
        case notes
        case totalDuration = "total_duration"
        case timeline
    }
}

struct TimelineItem: Decodable, Identifiable {
    let id = UUID()
    let drillID: String
    let durationMinutes: Int
    let startTimeMinutes: Int

    enum CodingKeys: String, CodingKey {
        case drillID = "drill_id"
        case durationMinutes = "duration_minutes"
        case startTimeMinutes = "start_time_minutes"
    }
}
