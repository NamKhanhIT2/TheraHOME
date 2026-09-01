export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_prompts: {
        Row: {
          id: boolean
          system_prompt: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          system_prompt: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          system_prompt?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ai_suggested_replies: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          sort_order: number
          text: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          text: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          sort_order?: number
          text?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          body: string | null
          cover_image_url: string | null
          id: string
          published_at: string
          read_time_minutes: number | null
          tag: string
          title: string
        }
        Insert: {
          body?: string | null
          cover_image_url?: string | null
          id?: string
          published_at?: string
          read_time_minutes?: number | null
          tag: string
          title: string
        }
        Update: {
          body?: string | null
          cover_image_url?: string | null
          id?: string
          published_at?: string
          read_time_minutes?: number | null
          tag?: string
          title?: string
        }
        Relationships: []
      }
      blocked_community_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      challenge_participants: {
        Row: {
          challenge_id: string
          completed_at: string | null
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          icon: string
          id: string
          start_date: string
          target_streak_days: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          icon?: string
          id?: string
          start_date?: string
          target_streak_days?: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          icon?: string
          id?: string
          start_date?: string
          target_streak_days?: number
          title?: string
        }
        Relationships: []
      }
      chat_message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachment_path: string | null
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string | null
          sender_type: string
          thread_id: string
        }
        Insert: {
          attachment_path?: string | null
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_type: string
          thread_id: string
        }
        Update: {
          attachment_path?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_type?: string
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          assigned_specialist_id: string | null
          created_at: string
          id: string
          kind: string
          status: string
          user_id: string
        }
        Insert: {
          assigned_specialist_id?: string | null
          created_at?: string
          id?: string
          kind: string
          status?: string
          user_id: string
        }
        Update: {
          assigned_specialist_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          author_avatar_url: string | null
          author_id: string | null
          author_name: string | null
          comments_count: number
          created_at: string
          day_milestone: number | null
          hidden: boolean
          id: string
          image_url: string | null
          is_official: boolean
          likes_count: number
          media_urls: string[]
          notify_enabled: boolean
          phase_milestone: string | null
          pinned: boolean
          pinned_content: string | null
          pinned_thumbnail_url: string | null
          pinned_title: string | null
          post_type: string
          progress_snapshot: Json | null
          saves_count: number
          status: string
          tag: string | null
          target_markets: string[] | null
          text: string
          text_malay: string | null
          text_us: string | null
          title: string | null
          title_malay: string | null
          title_us: string | null
        }
        Insert: {
          author_avatar_url?: string | null
          author_id?: string | null
          author_name?: string | null
          comments_count?: number
          created_at?: string
          day_milestone?: number | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          is_official?: boolean
          likes_count?: number
          media_urls?: string[]
          notify_enabled?: boolean
          phase_milestone?: string | null
          pinned?: boolean
          pinned_content?: string | null
          pinned_thumbnail_url?: string | null
          pinned_title?: string | null
          post_type?: string
          progress_snapshot?: Json | null
          saves_count?: number
          status?: string
          tag?: string | null
          target_markets?: string[] | null
          text: string
          text_malay?: string | null
          text_us?: string | null
          title?: string | null
          title_malay?: string | null
          title_us?: string | null
        }
        Update: {
          author_avatar_url?: string | null
          author_id?: string | null
          author_name?: string | null
          comments_count?: number
          created_at?: string
          day_milestone?: number | null
          hidden?: boolean
          id?: string
          image_url?: string | null
          is_official?: boolean
          likes_count?: number
          media_urls?: string[]
          notify_enabled?: boolean
          phase_milestone?: string | null
          pinned?: boolean
          pinned_content?: string | null
          pinned_thumbnail_url?: string | null
          pinned_title?: string | null
          post_type?: string
          progress_snapshot?: Json | null
          saves_count?: number
          status?: string
          tag?: string | null
          target_markets?: string[] | null
          text?: string
          text_malay?: string | null
          text_us?: string | null
          title?: string | null
          title_malay?: string | null
          title_us?: string | null
        }
        Relationships: []
      }
      content_reports: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          note: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          note?: string | null
          reason: string
          reporter_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          note?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      hidden_community_comments: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_community_comments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      hidden_community_posts: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hidden_community_posts_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_avatar_url: string | null
          actor_id: string | null
          actor_is_official: boolean
          actor_name: string | null
          body: string | null
          created_at: string
          destination: string | null
          group_actor_ids: string[]
          id: string
          push_body: string | null
          push_title: string | null
          reaction_type: string | null
          read: boolean
          related_chat_thread_id: string | null
          related_comment_id: string | null
          related_day_id: string | null
          related_parent_comment_id: string | null
          related_post_id: string | null
          related_product_id: string | null
          second_actor_name: string | null
          system_key: string | null
          title: string
          type: string
          upsell_campaign_id: string | null
          user_id: string
        }
        Insert: {
          actor_avatar_url?: string | null
          actor_id?: string | null
          actor_is_official?: boolean
          actor_name?: string | null
          body?: string | null
          created_at?: string
          destination?: string | null
          group_actor_ids?: string[]
          id?: string
          push_body?: string | null
          push_title?: string | null
          reaction_type?: string | null
          read?: boolean
          related_chat_thread_id?: string | null
          related_comment_id?: string | null
          related_day_id?: string | null
          related_parent_comment_id?: string | null
          related_post_id?: string | null
          related_product_id?: string | null
          second_actor_name?: string | null
          system_key?: string | null
          title: string
          type: string
          upsell_campaign_id?: string | null
          user_id: string
        }
        Update: {
          actor_avatar_url?: string | null
          actor_id?: string | null
          actor_is_official?: boolean
          actor_name?: string | null
          body?: string | null
          created_at?: string
          destination?: string | null
          group_actor_ids?: string[]
          id?: string
          push_body?: string | null
          push_title?: string | null
          reaction_type?: string | null
          read?: boolean
          related_chat_thread_id?: string | null
          related_comment_id?: string | null
          related_day_id?: string | null
          related_parent_comment_id?: string | null
          related_post_id?: string | null
          related_product_id?: string | null
          second_actor_name?: string | null
          system_key?: string | null
          title?: string
          type?: string
          upsell_campaign_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_chat_thread_id_fkey"
            columns: ["related_chat_thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_comment_id_fkey"
            columns: ["related_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_day_id_fkey"
            columns: ["related_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_parent_comment_id_fkey"
            columns: ["related_parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_post_id_fkey"
            columns: ["related_post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_product_id_fkey"
            columns: ["related_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_upsell_campaign_id_fkey"
            columns: ["upsell_campaign_id"]
            isOneToOne: false
            referencedRelation: "upsell_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          activated_at: string | null
          activated_by_user_id: string | null
          activation_code: string
          created_at: string
          email: string | null
          id: string
          order_date: string
          phone: string | null
          product_id: string
          shopify_order_id: number | null
          status: string
        }
        Insert: {
          activated_at?: string | null
          activated_by_user_id?: string | null
          activation_code: string
          created_at?: string
          email?: string | null
          id?: string
          order_date?: string
          phone?: string | null
          product_id: string
          shopify_order_id?: number | null
          status?: string
        }
        Update: {
          activated_at?: string | null
          activated_by_user_id?: string | null
          activation_code?: string
          created_at?: string
          email?: string | null
          id?: string
          order_date?: string
          phone?: string | null
          product_id?: string
          shopify_order_id?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pain_logs: {
        Row: {
          id: string
          logged_at: string
          note: string | null
          program_day_id: string | null
          score: number
          user_id: string
          user_program_id: string
        }
        Insert: {
          id?: string
          logged_at?: string
          note?: string | null
          program_day_id?: string | null
          score: number
          user_id: string
          user_program_id: string
        }
        Update: {
          id?: string
          logged_at?: string
          note?: string | null
          program_day_id?: string | null
          score?: number
          user_id?: string
          user_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pain_logs_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pain_logs_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_promos: {
        Row: {
          apple_product_id: string | null
          cross_sell_badge: string | null
          cross_sell_cta_url: string | null
          cross_sell_description: string | null
          cross_sell_image_url: string | null
          cross_sell_title: string | null
          cross_sell_video_url: string | null
          id: string
          phase_id: string
          translations: Json
          unlock_badge: string | null
          unlock_benefits: Json | null
          unlock_description: string | null
          unlock_image_url: string | null
          unlock_package_desc: string | null
          unlock_package_name: string | null
          unlock_price_label: string | null
          unlock_subtitle: string | null
          unlock_title: string | null
          unlock_video_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          apple_product_id?: string | null
          cross_sell_badge?: string | null
          cross_sell_cta_url?: string | null
          cross_sell_description?: string | null
          cross_sell_image_url?: string | null
          cross_sell_title?: string | null
          cross_sell_video_url?: string | null
          id?: string
          phase_id: string
          translations?: Json
          unlock_badge?: string | null
          unlock_benefits?: Json | null
          unlock_description?: string | null
          unlock_image_url?: string | null
          unlock_package_desc?: string | null
          unlock_package_name?: string | null
          unlock_price_label?: string | null
          unlock_subtitle?: string | null
          unlock_title?: string | null
          unlock_video_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          apple_product_id?: string | null
          cross_sell_badge?: string | null
          cross_sell_cta_url?: string | null
          cross_sell_description?: string | null
          cross_sell_image_url?: string | null
          cross_sell_title?: string | null
          cross_sell_video_url?: string | null
          id?: string
          phase_id?: string
          translations?: Json
          unlock_badge?: string | null
          unlock_benefits?: Json | null
          unlock_description?: string | null
          unlock_image_url?: string | null
          unlock_package_desc?: string | null
          unlock_package_name?: string | null
          unlock_price_label?: string | null
          unlock_subtitle?: string | null
          unlock_title?: string | null
          unlock_video_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_promos_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: true
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_purchases: {
        Row: {
          apple_original_transaction_id: string | null
          apple_transaction_id: string | null
          id: string
          phase_id: string
          platform: string
          purchased_at: string
          revoked_at: string | null
          user_id: string
        }
        Insert: {
          apple_original_transaction_id?: string | null
          apple_transaction_id?: string | null
          id?: string
          phase_id: string
          platform?: string
          purchased_at?: string
          revoked_at?: string | null
          user_id: string
        }
        Update: {
          apple_original_transaction_id?: string | null
          apple_transaction_id?: string | null
          id?: string
          phase_id?: string
          platform?: string
          purchased_at?: string
          revoked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_purchases_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_avatar_url: string | null
          author_id: string
          author_name: string | null
          created_at: string
          hidden: boolean
          id: string
          image_url: string | null
          likes_count: number
          parent_comment_id: string | null
          post_id: string
          text: string
        }
        Insert: {
          author_avatar_url?: string | null
          author_id: string
          author_name?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          likes_count?: number
          parent_comment_id?: string | null
          post_id: string
          text: string
        }
        Update: {
          author_avatar_url?: string | null
          author_id?: string
          author_name?: string | null
          created_at?: string
          hidden?: boolean
          id?: string
          image_url?: string | null
          likes_count?: number
          parent_comment_id?: string | null
          post_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          reaction: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          reaction?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          reaction?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_saves: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_saves_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      product_activation_contacts: {
        Row: {
          claimed_at: string | null
          claimed_by_user_id: string | null
          contact_type: string
          contact_value: string
          created_at: string
          disabled: boolean
          id: string
          normalized_value: string
          note: string | null
          product_id: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          contact_type: string
          contact_value: string
          created_at?: string
          disabled?: boolean
          id?: string
          normalized_value: string
          note?: string | null
          product_id: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by_user_id?: string | null
          contact_type?: string
          contact_value?: string
          created_at?: string
          disabled?: boolean
          id?: string
          normalized_value?: string
          note?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_activation_contacts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          accent_color_key: string
          category: string
          created_at: string
          id: string
          name: string
          total_days: number
        }
        Insert: {
          accent_color_key?: string
          category: string
          created_at?: string
          id: string
          name: string
          total_days?: number
        }
        Update: {
          accent_color_key?: string
          category?: string
          created_at?: string
          id?: string
          name?: string
          total_days?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_level: string
          account_type: string
          app_role: string
          avatar_url: string | null
          country_confirmed: boolean
          created_at: string
          created_by: string | null
          daily_reminder_enabled: boolean
          daily_reminder_time: string
          dark_mode: boolean
          data_sharing_enabled: boolean
          deleted_at: string | null
          email: string | null
          evening_reminder_enabled: boolean
          evening_reminder_time: string
          expires_at: string | null
          full_name: string | null
          goal: string | null
          id: string
          intake_answers: Json
          language: string
          language_explicit: boolean
          last_login_at: string | null
          locked: boolean
          notes: string | null
          notify_comments: boolean
          notify_community: boolean
          notify_reactions: boolean
          notify_replies: boolean
          onboarding_completed: boolean
          phone: string | null
          treatment_area: string | null
          updated_at: string
          username: string | null
          water_goal_cups: number
        }
        Insert: {
          access_level?: string
          account_type?: string
          app_role?: string
          avatar_url?: string | null
          country_confirmed?: boolean
          created_at?: string
          created_by?: string | null
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          dark_mode?: boolean
          data_sharing_enabled?: boolean
          deleted_at?: string | null
          email?: string | null
          evening_reminder_enabled?: boolean
          evening_reminder_time?: string
          expires_at?: string | null
          full_name?: string | null
          goal?: string | null
          id: string
          intake_answers?: Json
          language?: string
          language_explicit?: boolean
          last_login_at?: string | null
          locked?: boolean
          notes?: string | null
          notify_comments?: boolean
          notify_community?: boolean
          notify_reactions?: boolean
          notify_replies?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          treatment_area?: string | null
          updated_at?: string
          username?: string | null
          water_goal_cups?: number
        }
        Update: {
          access_level?: string
          account_type?: string
          app_role?: string
          avatar_url?: string | null
          country_confirmed?: boolean
          created_at?: string
          created_by?: string | null
          daily_reminder_enabled?: boolean
          daily_reminder_time?: string
          dark_mode?: boolean
          data_sharing_enabled?: boolean
          deleted_at?: string | null
          email?: string | null
          evening_reminder_enabled?: boolean
          evening_reminder_time?: string
          expires_at?: string | null
          full_name?: string | null
          goal?: string | null
          id?: string
          intake_answers?: Json
          language?: string
          language_explicit?: boolean
          last_login_at?: string | null
          locked?: boolean
          notes?: string | null
          notify_comments?: boolean
          notify_community?: boolean
          notify_reactions?: boolean
          notify_replies?: boolean
          onboarding_completed?: boolean
          phone?: string | null
          treatment_area?: string | null
          updated_at?: string
          username?: string | null
          water_goal_cups?: number
        }
        Relationships: []
      }
      program_days: {
        Row: {
          day_number: number
          day_type: string
          id: string
          phase_id: string
          product_id: string
          support_tools_url_malay: string | null
          support_tools_url_us: string | null
          support_tools_url_vn: string | null
          video_url_malay: string | null
          video_url_us: string | null
          video_url_vn: string | null
        }
        Insert: {
          day_number: number
          day_type: string
          id?: string
          phase_id: string
          product_id: string
          support_tools_url_malay?: string | null
          support_tools_url_us?: string | null
          support_tools_url_vn?: string | null
          video_url_malay?: string | null
          video_url_us?: string | null
          video_url_vn?: string | null
        }
        Update: {
          day_number?: number
          day_type?: string
          id?: string
          phase_id?: string
          product_id?: string
          support_tools_url_malay?: string | null
          support_tools_url_us?: string | null
          support_tools_url_vn?: string | null
          video_url_malay?: string | null
          video_url_us?: string | null
          video_url_vn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "program_days_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_days_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      program_phases: {
        Row: {
          day_end: number
          day_start: number
          id: string
          name: string
          product_id: string
          sort_order: number
        }
        Insert: {
          day_end: number
          day_start: number
          id?: string
          name: string
          product_id: string
          sort_order: number
        }
        Update: {
          day_end?: number
          day_start?: number
          id?: string
          name?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "program_phases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          device_info: string | null
          expo_push_token: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: string | null
          expo_push_token: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: string | null
          expo_push_token?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          content: Json
          created_at: string
          id: string
          phase_id: string
          sort_order: number
        }
        Insert: {
          content: Json
          created_at?: string
          id?: string
          phase_id: string
          sort_order?: number
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          phase_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          group_key: string
          has_trial: boolean
          id: string
          is_primary: boolean
          market: string
          sort_order: number
          title: string
        }
        Insert: {
          group_key?: string
          has_trial?: boolean
          id: string
          is_primary?: boolean
          market?: string
          sort_order?: number
          title: string
        }
        Update: {
          group_key?: string
          has_trial?: boolean
          id?: string
          is_primary?: boolean
          market?: string
          sort_order?: number
          title?: string
        }
        Relationships: []
      }
      store_items: {
        Row: {
          accent_color_key: string
          category_id: string
          description: string | null
          external_link: string | null
          group_key: string
          id: string
          image_url: string | null
          market: string
          name: string
          preview_url: string | null
          price_text: string
          product_id: string | null
          sort_order: number
        }
        Insert: {
          accent_color_key?: string
          category_id: string
          description?: string | null
          external_link?: string | null
          group_key?: string
          id: string
          image_url?: string | null
          market?: string
          name: string
          preview_url?: string | null
          price_text: string
          product_id?: string | null
          sort_order?: number
        }
        Update: {
          accent_color_key?: string
          category_id?: string
          description?: string | null
          external_link?: string | null
          group_key?: string
          id?: string
          image_url?: string | null
          market?: string
          name?: string
          preview_url?: string | null
          price_text?: string
          product_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      system_notification_templates: {
        Row: {
          body: string
          language: string
          template_key: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body: string
          language?: string
          template_key: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          language?: string
          template_key?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      upsell_campaigns: {
        Row: {
          body: string
          body_en: string | null
          body_ms: string | null
          created_at: string
          created_by: string
          destination: string
          id: string
          processing_started_at: string | null
          recipient_count: number
          scheduled_for: string
          sent_at: string | null
          status: string
          target: string
          title: string
          title_en: string | null
          title_ms: string | null
        }
        Insert: {
          body: string
          body_en?: string | null
          body_ms?: string | null
          created_at?: string
          created_by: string
          destination?: string
          id?: string
          processing_started_at?: string | null
          recipient_count?: number
          scheduled_for: string
          sent_at?: string | null
          status?: string
          target?: string
          title: string
          title_en?: string | null
          title_ms?: string | null
        }
        Update: {
          body?: string
          body_en?: string | null
          body_ms?: string | null
          created_at?: string
          created_by?: string
          destination?: string
          id?: string
          processing_started_at?: string | null
          recipient_count?: number
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          target?: string
          title?: string
          title_en?: string | null
          title_ms?: string | null
        }
        Relationships: []
      }
      user_access_contacts: {
        Row: {
          contact_type: string
          contact_value: string
          created_at: string
          id: string
          normalized_value: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_type: string
          contact_value: string
          created_at?: string
          id?: string
          normalized_value: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_type?: string
          contact_value?: string
          created_at?: string
          id?: string
          normalized_value?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_program_days: {
        Row: {
          completed_at: string | null
          id: string
          program_day_id: string
          status: string
          user_program_id: string
        }
        Insert: {
          completed_at?: string | null
          id?: string
          program_day_id: string
          status?: string
          user_program_id: string
        }
        Update: {
          completed_at?: string | null
          id?: string
          program_day_id?: string
          status?: string
          user_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_program_days_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_program_days_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      user_programs: {
        Row: {
          activated_at: string
          adherence_pct: number
          current_day: number
          id: string
          order_id: string | null
          product_id: string
          streak: number
          user_id: string
        }
        Insert: {
          activated_at?: string
          adherence_pct?: number
          current_day?: number
          id?: string
          order_id?: string | null
          product_id: string
          streak?: number
          user_id: string
        }
        Update: {
          activated_at?: string
          adherence_pct?: number
          current_day?: number
          id?: string
          order_id?: string | null
          product_id?: string
          streak?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_programs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_programs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quiz_attempts: {
        Row: {
          answers: Json
          completed_at: string
          id: string
          phase_id: string
          score: number
          total_questions: number
          user_id: string
          user_program_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string
          id?: string
          phase_id: string
          score: number
          total_questions: number
          user_id: string
          user_program_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          id?: string
          phase_id?: string
          score?: number
          total_questions?: number
          user_id?: string
          user_program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quiz_attempts_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "program_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quiz_attempts_user_program_id_fkey"
            columns: ["user_program_id"]
            isOneToOne: false
            referencedRelation: "user_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          cups_logged: number
          id: string
          log_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cups_logged?: number
          id?: string
          log_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cups_logged?: number
          id?: string
          log_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      web_access_contacts: {
        Row: {
          claimed_by_user_id: string | null
          created_at: string
          disabled: boolean
          email: string | null
          id: string
          phone: string | null
          roles: string[]
        }
        Insert: {
          claimed_by_user_id?: string | null
          created_at?: string
          disabled?: boolean
          email?: string | null
          id?: string
          phone?: string | null
          roles?: string[]
        }
        Update: {
          claimed_by_user_id?: string | null
          created_at?: string
          disabled?: boolean
          email?: string | null
          id?: string
          phone?: string | null
          roles?: string[]
        }
        Relationships: []
      }
      winback_notifications_sent: {
        Row: {
          id: string
          last_active_at: string
          milestone_days: number
          sent_at: string
          user_id: string
        }
        Insert: {
          id?: string
          last_active_at: string
          milestone_days: number
          sent_at?: string
          user_id: string
        }
        Update: {
          id?: string
          last_active_at?: string
          milestone_days?: number
          sent_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "winback_notifications_sent_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_order: {
        Args: { p_order_id: string }
        Returns: {
          product_id: string
          user_program_id: string
        }[]
      }
      activate_orders_by_contact: {
        Args: { p_email?: string; p_phone?: string }
        Returns: {
          product_id: string
          user_program_id: string
        }[]
      }
      activate_product_by_contact: {
        Args: { p_contact: string; p_product_id: string }
        Returns: {
          product_id: string
          product_name: string
        }[]
      }
      admin_fetch_user_orders: {
        Args: { p_user_id: string }
        Returns: {
          activated_at: string
          order_date: string
          order_id: string
          order_status: string
          product_id: string
          product_name: string
        }[]
      }
      admin_set_user_phase: {
        Args: { p_phase_id: string; p_user_program_id: string }
        Returns: undefined
      }
      admin_update_user_contact: {
        Args: { p_email: string; p_phone: string; p_user_id: string }
        Returns: undefined
      }
      claim_user_access_contact: {
        Args: { p_contact: string }
        Returns: {
          access_roles: string[]
          contact_type: string
          contact_value: string
          programs_granted: number
        }[]
      }
      complete_day: {
        Args: {
          p_pain_score: number
          p_program_day_id: string
          p_user_program_id: string
        }
        Returns: undefined
      }
      contains_unsafe_community_content: {
        Args: { p_text: string }
        Returns: boolean
      }
      create_community_comment: {
        Args: {
          p_image_url?: string
          p_parent_comment_id?: string
          p_post_id: string
          p_text: string
        }
        Returns: string
      }
      create_inactivity_notification: {
        Args: {
          p_body: string
          p_inactive_days: number
          p_title: string
          p_user_id: string
        }
        Returns: string
      }
      create_official_community_post: {
        Args: {
          p_notify?: boolean
          p_target_markets?: string[]
          p_text: string
          p_text_malay?: string
          p_text_us?: string
          p_title: string
          p_title_malay?: string
          p_title_us?: string
        }
        Returns: string
      }
      current_web_roles: { Args: never; Returns: string[] }
      delete_account: { Args: never; Returns: undefined }
      format_community_notification: {
        Args: {
          p_actor_name: string
          p_group_count: number
          p_preview: string
          p_second_actor_name: string
          p_type: string
        }
        Returns: {
          body: string
          push_body: string
          push_title: string
          title: string
        }[]
      }
      get_community_profile: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          completed_days: number
          completed_programs: number
          current_streak: number
          full_name: string
          posts_count: number
          user_id: string
        }[]
      }
      get_default_product_for_contact: { Args: never; Returns: string }
      get_winback_candidates: {
        Args: never
        Returns: {
          last_active_at: string
          milestone_days: number
          user_id: string
        }[]
      }
      lookup_order: {
        Args: { p_email?: string; p_phone?: string }
        Returns: {
          order_id: string
          order_status: string
          product_id: string
          product_name: string
        }[]
      }
      lookup_order_by_code: {
        Args: { p_code: string }
        Returns: {
          order_id: string
          order_status: string
          product_id: string
          product_name: string
        }[]
      }
      lookup_web_access_contact: {
        Args: { p_email?: string; p_phone?: string }
        Returns: string[]
      }
      mark_day_watched: {
        Args: { p_program_day_id: string; p_user_program_id: string }
        Returns: boolean
      }
      normalize_phone_vn: { Args: { p_phone: string }; Returns: string }
      provision_product_for_user: {
        Args: { p_product_id: string; p_user_id: string }
        Returns: undefined
      }
      record_local_reminder_notification: {
        Args: { p_body: string; p_destination?: string; p_title: string }
        Returns: string
      }
      resolve_thera_login_email: {
        Args: { p_username: string }
        Returns: string
      }
      set_official_post_pinned: {
        Args: {
          p_content?: string
          p_pinned: boolean
          p_post_id: string
          p_thumbnail_url?: string
          p_title?: string
        }
        Returns: undefined
      }
      touch_last_login: { Args: never; Returns: undefined }
      truncate_with_ellipsis: {
        Args: { p_max: number; p_text: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
