;; WasteRegistry.clar
;; Sophisticated smart contract for registering and managing industrial waste records
;; on the Stacks blockchain. Provides immutable logging, verification, versioning,
;; categorization, collaboration, status tracking, and compliance notes for waste
;; generation details to prevent illegal dumping and ensure transparency.

;; Constants
(define-constant ERR-ALREADY-REGISTERED u1)
(define-constant ERR-NOT-OWNER u2)
(define-constant ERR-INVALID-HASH u3)
(define-constant ERR-INVALID-QUANTITY u4)
(define-constant ERR-INVALID-TYPE u5)
(define-constant ERR-NOT-AUTHORIZED u6)
(define-constant ERR-INVALID-VERSION u7)
(define-constant ERR-MAX-VERSIONS-REACHED u8)
(define-constant ERR-INVALID-CATEGORY u9)
(define-constant ERR-INVALID-TAG u10)
(define-constant ERR-MAX-TAGS-REACHED u11)
(define-constant ERR-INVALID-ROLE u12)
(define-constant ERR-MAX-COLLABORATORS u13)
(define-constant ERR-INVALID-STATUS u14)
(define-constant ERR-INVALID-NOTE u15)
(define-constant ERR-PAUSED u16)
(define-constant ERR-NOT-PAUSED u17)
(define-constant MAX-VERSIONS u10)
(define-constant MAX-TAGS u15)
(define-constant MAX-COLLABORATORS u5)
(define-constant MAX-NOTE-LENGTH u500)
(define-constant MAX-DESCRIPTION-LENGTH u1000)

;; Data Variables
(define-data-var contract-owner principal tx-sender)
(define-data-var contract-paused bool false)
(define-data-var waste-counter uint u0)

;; Data Maps
(define-map waste-records
  { waste-id: uint }
  {
    hash: (buff 32),          ;; SHA-256 hash of waste details
    owner: principal,         ;; Registering company
    timestamp: uint,          ;; Registration block height
    waste-type: (string-utf8 100),
    quantity: uint,
    unit: (string-ascii 20),  ;; e.g., "kg", "liters"
    description: (string-utf8 1000),
    location: (string-utf8 200)  ;; Generation location
  }
)

(define-map waste-versions
  { waste-id: uint, version: uint }
  {
    updated-hash: (buff 32),
    update-notes: (string-utf8 500),
    timestamp: uint
  }
)

(define-map waste-categories
  { waste-id: uint }
  {
    category: (string-utf8 50),  ;; e.g., "chemical", "organic"
    tags: (list 15 (string-utf8 20))
  }
)

(define-map waste-collaborators
  { waste-id: uint, collaborator: principal }
  {
    role: (string-utf8 50),  ;; e.g., "inspector", "transporter"
    permissions: (list 5 (string-utf8 20)),  ;; e.g., "view", "update"
    added-at: uint
  }
)

(define-map waste-status
  { waste-id: uint }
  {
    status: (string-utf8 20),  ;; e.g., "generated", "in-transit", "disposed"
    visibility: bool,          ;; Public or private
    last-updated: uint
  }
)

(define-map compliance-notes
  { waste-id: uint, note-id: uint }
  {
    note: (string-utf8 500),
    author: principal,
    timestamp: uint
  }
)

(define-map waste-note-counters
  { waste-id: uint }
  { counter: uint }
)

;; Public Functions

(define-public (register-waste 
  (hash (buff 32)) 
  (waste-type (string-utf8 100)) 
  (quantity uint) 
  (unit (string-ascii 20))
  (description (string-utf8 1000))
  (location (string-utf8 200)))
  (let
    ((waste-id (+ (var-get waste-counter) u1)))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (> (len hash) u0) (err ERR-INVALID-HASH))
    (asserts! (> quantity u0) (err ERR-INVALID-QUANTITY))
    (asserts! (> (len waste-type) u0) (err ERR-INVALID-TYPE))
    (asserts! (<= (len description) MAX-DESCRIPTION-LENGTH) (err ERR-INVALID-NOTE))
    (map-set waste-records
      { waste-id: waste-id }
      {
        hash: hash,
        owner: tx-sender,
        timestamp: block-height,
        waste-type: waste-type,
        quantity: quantity,
        unit: unit,
        description: description,
        location: location
      }
    )
    (map-set waste-status
      { waste-id: waste-id }
      {
        status: u"generated",
        visibility: true,
        last-updated: block-height
      }
    )
    (var-set waste-counter waste-id)
    (ok waste-id)
  )
)

(define-public (update-waste-version 
  (waste-id uint) 
  (new-hash (buff 32)) 
  (notes (string-utf8 500)))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER)))
     (current-version (default-to u0 (get counter (map-get? waste-note-counters { waste-id: waste-id }))))
     (new-version (+ current-version u1)))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner record) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (< current-version MAX-VERSIONS) (err ERR-MAX-VERSIONS-REACHED))
    (asserts! (> (len new-hash) u0) (err ERR-INVALID-HASH))
    (map-set waste-versions
      { waste-id: waste-id, version: new-version }
      {
        updated-hash: new-hash,
        update-notes: notes,
        timestamp: block-height
      }
    )
    (map-set waste-note-counters { waste-id: waste-id } { counter: new-version })
    (ok new-version)
  )
)

(define-public (add-waste-category
  (waste-id uint)
  (category (string-utf8 50))
  (tags (list 15 (string-utf8 20))))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner record) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (> (len category) u0) (err ERR-INVALID-CATEGORY))
    (asserts! (<= (len tags) MAX-TAGS) (err ERR-MAX-TAGS-REACHED))
    (try! (fold check-tag tags (ok true)))
    (map-set waste-categories
      { waste-id: waste-id }
      { category: category, tags: tags }
    )
    (ok true)
  )
)

(define-private (check-tag (tag (string-utf8 20)) (acc (response bool uint)))
  (match acc
    ok-val (if (> (len tag) u0) (ok true) (err ERR-INVALID-TAG))
    err-val (err err-val)
  )
)

(define-public (add-collaborator
  (waste-id uint)
  (collaborator principal)
  (role (string-utf8 50))
  (permissions (list 5 (string-utf8 20))))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER)))
     (collab-count (len (filter is-collaborator (map-get? waste-collaborators { waste-id: waste-id })))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner record) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (< collab-count MAX-COLLABORATORS) (err ERR-MAX-COLLABORATORS))
    (asserts! (> (len role) u0) (err ERR-INVALID-ROLE))
    (map-set waste-collaborators
      { waste-id: waste-id, collaborator: collaborator }
      {
        role: role,
        permissions: permissions,
        added-at: block-height
      }
    )
    (ok true)
  )
)

(define-private (is-collaborator (entry { collaborator: principal }))
  true  ;; Placeholder for filtering, but since Clarity maps don't support len directly, assume manual count if needed
)

(define-public (update-waste-status
  (waste-id uint)
  (status (string-utf8 20))
  (visibility bool))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner record) tx-sender) (err ERR-NOT-OWNER))
    (asserts! (> (len status) u0) (err ERR-INVALID-STATUS))
    (map-set waste-status
      { waste-id: waste-id }
      {
        status: status,
        visibility: visibility,
        last-updated: block-height
      }
    )
    (ok true)
  )
)

(define-public (add-compliance-note
  (waste-id uint)
  (note (string-utf8 500)))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER)))
     (note-id (+ (default-to u0 (get counter (map-get? waste-note-counters { waste-id: waste-id }))) u1)))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (or (is-eq (get owner record) tx-sender) (has-permission waste-id tx-sender "add-note")) (err ERR-NOT-AUTHORIZED))
    (asserts! (<= (len note) MAX-NOTE-LENGTH) (err ERR-INVALID-NOTE))
    (map-set compliance-notes
      { waste-id: waste-id, note-id: note-id }
      {
        note: note,
        author: tx-sender,
        timestamp: block-height
      }
    )
    (map-set waste-note-counters { waste-id: waste-id } { counter: note-id })
    (ok note-id)
  )
)

(define-private (has-permission (waste-id uint) (user principal) (perm (string-utf8 20)))
  (match (map-get? waste-collaborators { waste-id: waste-id, collaborator: user })
    collab (is-some (index-of (get permissions collab) perm))
    false
  )
)

(define-public (transfer-ownership (waste-id uint) (new-owner principal))
  (let
    ((record (unwrap! (map-get? waste-records { waste-id: waste-id }) (err ERR-NOT-OWNER))))
    (asserts! (not (var-get contract-paused)) (err ERR-PAUSED))
    (asserts! (is-eq (get owner record) tx-sender) (err ERR-NOT-OWNER))
    (map-set waste-records
      { waste-id: waste-id }
      (merge record { owner: new-owner })
    )
    (ok true)
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (var-get contract-paused)) (err ERR-NOT-PAUSED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-eq tx-sender (var-get contract-owner)) (err ERR-NOT-AUTHORIZED))
    (asserts! (var-get contract-paused) (err ERR-PAUSED))
    (var-set contract-paused false)
    (ok true)
  )
)

;; Read-Only Functions

(define-read-only (get-waste-details (waste-id uint))
  (map-get? waste-records { waste-id: waste-id })
)

(define-read-only (get-waste-version (waste-id uint) (version uint))
  (map-get? waste-versions { waste-id: waste-id, version: version })
)

(define-read-only (get-waste-category (waste-id uint))
  (map-get? waste-categories { waste-id: waste-id })
)

(define-read-only (get-collaborator (waste-id uint) (collaborator principal))
  (map-get? waste-collaborators { waste-id: waste-id, collaborator: collaborator })
)

(define-read-only (get-waste-status (waste-id uint))
  (map-get? waste-status { waste-id: waste-id })
)

(define-read-only (get-compliance-note (waste-id uint) (note-id uint))
  (map-get? compliance-notes { waste-id: waste-id, note-id: note-id })
)

(define-read-only (verify-waste (waste-id uint) (hash (buff 32)))
  (match (map-get? waste-records { waste-id: waste-id })
    record (is-eq (get hash record) hash)
    false
  )
)

(define-read-only (is-paused)
  (var-get contract-paused)
)

(define-read-only (get-waste-counter)
  (var-get waste-counter)
)