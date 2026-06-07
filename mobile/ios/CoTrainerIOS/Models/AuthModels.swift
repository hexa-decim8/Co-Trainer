import Foundation

struct LoginResponse: Decodable {
    let accessToken: String
    let tokenType: String
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case tokenType = "token_type"
        case user
    }
}

struct User: Decodable, Equatable {
    let id: Int
    let email: String
    let derbyName: String?
    let role: String
    let isApproved: Bool?

    enum CodingKeys: String, CodingKey {
        case id
        case email
        case derbyName = "derby_name"
        case role
        case isApproved = "is_approved"
    }
}

struct LoginForm {
    let email: String
    let password: String
}
