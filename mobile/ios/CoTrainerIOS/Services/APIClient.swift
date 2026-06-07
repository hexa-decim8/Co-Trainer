import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case unauthorized
    case rateLimited
    case serverError(String)
    case transport(Error)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL."
        case .unauthorized:
            return "Your session expired. Please log in again."
        case .rateLimited:
            return "Too many attempts. Try again in a moment."
        case let .serverError(message):
            return message
        case let .transport(error):
            return error.localizedDescription
        case let .decoding(error):
            return "Failed to decode server response: \(error.localizedDescription)"
        }
    }
}

final class APIClient {
    private let session: URLSession
    private let decoder: JSONDecoder

    init(session: URLSession = .shared) {
        self.session = session

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        self.decoder = decoder
    }

    func request<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        do {
            let (data, response) = try await session.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError("Invalid server response.")
            }

            switch httpResponse.statusCode {
            case 200 ..< 300:
                do {
                    return try decoder.decode(type, from: data)
                } catch {
                    throw APIError.decoding(error)
                }
            case 401:
                throw APIError.unauthorized
            case 429:
                throw APIError.rateLimited
            default:
                let message = String(data: data, encoding: .utf8) ?? "Unexpected server error."
                throw APIError.serverError(message)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error)
        }
    }
}
